import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { SupabaseClient } from "@supabase/supabase-js";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

function formatFilename(grade: string, discipline: string, lessonNumber: number): string {
  return `${grade}-${discipline}-L${lessonNumber}.pdf`;
}

function addTargetBlankAndArrowsToLinks(obj: any): any {
  if (typeof obj === 'string') {
    let result = obj;

    // Resource links - add target="_blank"
    result = result.replace(/<a(\s+[^>]*)?class\s*=\s*["'][^"']*resource-link[^"']*["'](\s+[^>]*)?>/gi, (match) => {
      if (match.includes('target=')) return match;
      return match.replace(/^<a/, '<a target="_blank"');
    });

    // YouTube links (with class) - add target="_blank"
    result = result.replace(/<a(\s+[^>]*)?class\s*=\s*["'][^"']*youtube-link[^"']*["'](\s+[^>]*)?>/gi, (match) => {
      if (match.includes('target=')) return match;
      return match.replace(/^<a/, '<a target="_blank"');
    });

    // YouTube links (auto-detected by URL) - add target="_blank"
    result = result.replace(/<a(\s+[^>]*)?href\s*=\s*["'][^"']*(youtube\.com|youtu\.be)[^"']*["'](\s+[^>]*)?>/gi, (match) => {
      if (match.includes('target=')) return match;
      return match.replace(/^<a/, '<a target="_blank"');
    });

    return result;
  }
  if (Array.isArray(obj)) {
    return obj.map(item => addTargetBlankAndArrowsToLinks(item));
  }
  if (obj && typeof obj === 'object') {
    const result: any = {};
    for (const key in obj) {
      result[key] = addTargetBlankAndArrowsToLinks(obj[key]);
    }
    return result;
  }
  return obj;
}

interface UploadResult {
  error?: string;
  details?: any;
  storagePath?: string;
  fileSize?: number;
}

async function uploadPdfToStorage(
  supabaseAdmin: SupabaseClient,
  lessonId: string,
  filename: string,
  pdfBuffer: ArrayBuffer,
  userId: string,
  fileSize: number,
  storagePath: string
): Promise<UploadResult> {
  console.log("Uploading PDF to storage:", storagePath, "Size:", fileSize);

  const { error: removeError } = await supabaseAdmin.storage
    .from("lesson-pdfs")
    .remove([storagePath]);

  if (removeError) {
    console.log("Remove error (may not exist):", removeError.message);
  }

  const { error: uploadError } = await supabaseAdmin.storage
    .from("lesson-pdfs")
    .upload(storagePath, pdfBuffer, {
      contentType: "application/pdf",
      upsert: true,
    });

  if (uploadError) {
    console.error("Storage upload error:", uploadError);
    return {
      error: "Failed to upload PDF to storage",
      details: uploadError.message,
      storagePath,
      fileSize
    };
  }

  const { error: upsertError } = await supabaseAdmin
    .from("lesson_pdfs")
    .upsert({
      lesson_id: lessonId,
      storage_path: storagePath,
      file_size: fileSize,
      generated_at: new Date().toISOString(),
      generated_by: userId,
    }, {
      onConflict: "lesson_id",
    });

  if (upsertError) {
    console.error("Database upsert error:", upsertError);
    return { error: "Failed to save PDF metadata" };
  }

  return {};
}

async function updateBatchResultOnSuccess(
  supabaseAdmin: SupabaseClient,
  lessonId: string
): Promise<void> {
  const { data: failedEntries } = await supabaseAdmin
    .from("batch_pdf_results")
    .select("id, job_id")
    .eq("lesson_id", lessonId)
    .eq("status", "failed");

  if (failedEntries && failedEntries.length > 0) {
    for (const entry of failedEntries) {
      await supabaseAdmin
        .from("batch_pdf_results")
        .update({
          status: "success",
          error_message: null,
          processed_at: new Date().toISOString(),
        })
        .eq("id", entry.id);

      const { data: job } = await supabaseAdmin
        .from("batch_pdf_jobs")
        .select("failure_count, success_count")
        .eq("id", entry.job_id)
        .single();

      if (job) {
        await supabaseAdmin
          .from("batch_pdf_jobs")
          .update({
            failure_count: Math.max(0, job.failure_count - 1),
            success_count: job.success_count + 1,
          })
          .eq("id", entry.job_id);
      }
    }
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ lessonId: string }> }
) {
  try {
    const { lessonId } = await params;

    if (!lessonId) {
      return NextResponse.json({ error: "Lesson ID required" }, { status: 400 });
    }

    // Parse request body for priority
    let body: { priority?: number } = {};
    try {
      body = await request.json();
    } catch {
      // No body provided, use defaults
    }

    const priority = body.priority || 1; // Default to high priority (1), batch jobs pass 9

    // Auth check - must be admin
    const supabase = await createClient();
    const supabaseAdmin = await createServiceClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError || profile?.role !== "admin") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    // Fetch lesson data
    const { data: lesson, error: lessonError } = await supabase
      .from("lessons")
      .select("*")
      .eq("id", lessonId)
      .single();

    if (lessonError || !lesson) {
      return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
    }

    // Fetch course data
    const { data: course, error: courseError } = await supabase
      .from("courses")
      .select("title, discipline, grade, pdf_image_url")
      .eq("id", lesson.course_id)
      .single();

    if (courseError || !course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    // Generate filename - no timestamp, each generation replaces the previous
    const filename = formatFilename(course.grade, course.discipline, lesson.lesson_number);
    const storagePath = `${lessonId}/${filename}`;

    // Call Render PDF service - submit to queue for priority processing
    const pdfServiceUrl = process.env.PDF_SERVICE_URL;

    if (!pdfServiceUrl) {
      return NextResponse.json({ error: "PDF service not configured" }, { status: 500 });
    }

    // Submit to queue instead of generating directly
    const submitResponse = await fetch(`${pdfServiceUrl}/queue/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pdfType: "lesson",
        payload: {
          lesson: addTargetBlankAndArrowsToLinks(lesson),
          course,
          filename,
        },
        priority,
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!submitResponse.ok) {
      const errorData = await submitResponse.json();
      return NextResponse.json(
        { error: errorData.error || "Failed to submit job to queue" },
        { status: submitResponse.status }
      );
    }

    const { jobId } = await submitResponse.json();

    // Poll for completion
    const maxWaitTime = 120000; // 2 minutes
    const pollInterval = 2000;
    const startTime = Date.now();

    let pdfBuffer: ArrayBuffer | null = null;

    while (Date.now() - startTime < maxWaitTime) {
      const statusRes = await fetch(`${pdfServiceUrl}/queue/status/${jobId}`, {
        signal: AbortSignal.timeout(5000),
      });

      if (statusRes.ok) {
        const statusData = await statusRes.json();

        if (statusData.status === "completed") {
          // Get the PDF result
          const resultRes = await fetch(`${pdfServiceUrl}/queue/result/${jobId}`, {
            signal: AbortSignal.timeout(30000),
          });

          if (resultRes.headers.get("content-type")?.includes("application/pdf")) {
            pdfBuffer = await resultRes.arrayBuffer();
          }
          break;
        }

        if (statusData.status === "failed") {
          return NextResponse.json(
            { error: statusData.error || "PDF generation failed" },
            { status: 500 }
          );
        }
      }

      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }

    if (pdfBuffer === null) {
      return NextResponse.json(
        { error: "PDF generation timed out" },
        { status: 500 }
      );
    }

    const fileSize = pdfBuffer.byteLength;

    // Check file size limit
    if (fileSize > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `PDF file too large (max ${MAX_FILE_SIZE / 1024 / 1024}MB)`, actualSize: fileSize },
        { status: 400 }
      );
    }

    // Upload to Supabase Storage
    console.log("Uploading PDF to storage:", storagePath, "Size:", fileSize);

    // Delete existing file first, then upload fresh (don't use upsert)
    const { error: removeError } = await supabaseAdmin.storage
      .from("lesson-pdfs")
      .remove([storagePath]);

    if (removeError) {
      console.log("Remove error (may not exist):", removeError.message);
    }

    const { error: uploadError } = await supabaseAdmin.storage
      .from("lesson-pdfs")
      .upload(storagePath, pdfBuffer, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      return NextResponse.json({
        error: "Failed to upload PDF to storage",
        details: uploadError.message,
        storagePath,
        fileSize
      }, { status: 500 });
    }

    // Upsert record in lesson_pdfs table
    const { error: upsertError } = await supabaseAdmin
      .from("lesson_pdfs")
      .upsert({
        lesson_id: lessonId,
        storage_path: storagePath,
        file_size: fileSize,
        generated_at: new Date().toISOString(),
        generated_by: user.id,
      }, {
        onConflict: "lesson_id",
      });

    if (upsertError) {
      console.error("Database upsert error:", upsertError);
      return NextResponse.json({ error: "Failed to save PDF metadata" }, { status: 500 });
    }

    // Find any failed batch_pdf_results for this lesson and update to success
    const { data: failedEntries } = await supabaseAdmin
      .from("batch_pdf_results")
      .select("id, job_id")
      .eq("lesson_id", lessonId)
      .eq("status", "failed");

    if (failedEntries && failedEntries.length > 0) {
      for (const entry of failedEntries) {
        // Update the entry to success
        await supabaseAdmin
          .from("batch_pdf_results")
          .update({
            status: "success",
            error_message: null,
            processed_at: new Date().toISOString(),
          })
          .eq("id", entry.id);

        // Update the job's counters: decrement failure_count, increment success_count
        const { data: job } = await supabaseAdmin
          .from("batch_pdf_jobs")
          .select("failure_count, success_count")
          .eq("id", entry.job_id)
          .single();

        if (job) {
          await supabaseAdmin
            .from("batch_pdf_jobs")
            .update({
              failure_count: Math.max(0, job.failure_count - 1),
              success_count: job.success_count + 1,
            })
            .eq("id", entry.job_id);
        }
      }
    }

    return NextResponse.json({
      success: true,
      filename,
      file_size: fileSize,
      generated_at: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("PDF generate error:", error);
    
    if (error.name === "TimeoutError") {
      return NextResponse.json({ error: "PDF generation timed out" }, { status: 500 });
    }
    
    return NextResponse.json({ error: error.message || "Failed to generate PDF" }, { status: 500 });
  }
}
