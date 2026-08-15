import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getPdfFileName, getWeekStart, formatWeekStart, TEXT_FIELDS_LIST } from "@/lib/version-utils";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const WEEKLY_PDF_LIMIT = 20;

function addTargetBlankAndArrowsToLinks(obj: any): any {
  if (typeof obj === "string") {
    let result = obj;

    result = result.replace(/<a(\s+[^>]*)?class\s*=\s*["'][^"']*resource-link[^"']*["'](\s+[^>]*)?>/gi, (match) => {
      if (match.includes("target=")) return match;
      return match.replace(/^<a/, '<a target="_blank"');
    });

    result = result.replace(/<a(\s+[^>]*)?class\s*=\s*["'][^"']*youtube-link[^"']*["'](\s+[^>]*)?>/gi, (match) => {
      if (match.includes("target=")) return match;
      return match.replace(/^<a/, '<a target="_blank"');
    });

    result = result.replace(/<a(\s+[^>]*)?href\s*=\s*["'][^"']*(youtube\.com|youtu\.be)[^"']*["'](\s+[^>]*)?>/gi, (match) => {
      if (match.includes("target=")) return match;
      return match.replace(/^<a/, '<a target="_blank"');
    });

    return result;
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => addTargetBlankAndArrowsToLinks(item));
  }
  if (obj && typeof obj === "object") {
    const result: any = {};
    for (const key in obj) {
      result[key] = addTargetBlankAndArrowsToLinks(obj[key]);
    }
    return result;
  }
  return obj;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ lessonId: string; versionId: string }> }
) {
  try {
    const { lessonId, versionId } = await params;
    const { searchParams } = new URL(request.url);
    const download = searchParams.get("download") === "true";

    if (!lessonId || !versionId) {
      return NextResponse.json({ error: "Lesson ID and Version ID required" }, { status: 400 });
    }

    const supabaseAdmin = await createServiceClient();

    const { data: version, error: versionError } = await supabaseAdmin
      .from("lesson_versions")
      .select("pdf_storage_path, version_name, version_number")
      .eq("id", versionId)
      .eq("lesson_id", lessonId)
      .is("deleted_at", null)
      .single();

    if (versionError || !version) {
      return NextResponse.json({ error: "Version not found" }, { status: 404 });
    }

    if (!version.pdf_storage_path) {
      return NextResponse.json({ error: "No PDF generated for this version" }, { status: 404 });
    }

    const storagePath = version.pdf_storage_path;
    const filename = storagePath.split("/").pop() || "version.pdf";

    const { data: fileData, error: fileError } = await supabaseAdmin.storage
      .from("lesson-version-pdfs")
      .download(storagePath);

    if (fileError || !fileData) {
      console.error("Error downloading from storage:", fileError);
      return NextResponse.json({ error: "Failed to download PDF from storage" }, { status: 500 });
    }

    const buffer = await fileData.arrayBuffer();

    return new Response(buffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Length": buffer.byteLength.toString(),
        "Content-Disposition": download
          ? `attachment; filename="${filename}"`
          : `inline; filename="${filename}"`,
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
      },
    });
  } catch (error: any) {
    console.error("Version PDF GET error:", error);
    return NextResponse.json({ error: error.message || "Failed to get PDF" }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ lessonId: string; versionId: string }> }
) {
  try {
    const { lessonId, versionId } = await params;

    if (!lessonId || !versionId) {
      return NextResponse.json({ error: "Lesson ID and Version ID required" }, { status: 400 });
    }

    const supabase = await createClient();
    const supabaseAdmin = await createServiceClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const weekStart = getWeekStart();
    const weekStartStr = formatWeekStart(weekStart);

    const { data: pdfUsage, error: pdfUsageError } = await supabase
      .from("lesson_version_pdf_usage")
      .select("pdf_count")
      .eq("user_id", user.id)
      .eq("week_start", weekStartStr)
      .single();

    const currentCount = pdfUsage?.pdf_count || 0;

    if (currentCount >= WEEKLY_PDF_LIMIT) {
      return NextResponse.json(
        {
          error: "Weekly PDF limit reached",
          pdf_count: currentCount,
          limit: WEEKLY_PDF_LIMIT,
          week_start: weekStartStr,
        },
        { status: 403 }
      );
    }

    const { data: version, error: versionError } = await supabase
      .from("lesson_versions")
      .select("*")
      .eq("id", versionId)
      .eq("lesson_id", lessonId)
      .is("deleted_at", null)
      .single();

    if (versionError || !version) {
      return NextResponse.json({ error: "Version not found" }, { status: 404 });
    }

    const { data: lesson, error: lessonError } = await supabase
      .from("lessons")
      .select("*, lesson_outline, learning_objectives, vocabulary, materials, vapa_text_block, ncas_text_block, welcome_opening, actual_class_expectations, warm_up, lesson_hook, main_activity, instrument_expectations, reflection, closing_ceremony, assessment")
      .eq("id", lessonId)
      .single();

    if (lessonError || !lesson) {
      return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
    }

    const { data: course, error: courseError } = await supabase
      .from("courses")
      .select("title, discipline, grade, pdf_image_url")
      .eq("id", lesson.course_id)
      .single();

    if (courseError || !course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    const versionContent = version.content as Record<string, { html: string }>;
    const lessonForPdf: Record<string, unknown> = { ...lesson };

    for (const field of TEXT_FIELDS_LIST) {
      if (versionContent[field]?.html) {
        (lessonForPdf as Record<string, string>)[field] = addTargetBlankAndArrowsToLinks(
          versionContent[field].html
        );
      } else if (lesson[field as keyof typeof lesson]) {
        (lessonForPdf as Record<string, string>)[field] = lesson[field as keyof typeof lesson] as string;
      }
    }

    lessonForPdf.title = version.version_name || `Version ${version.version_number}`;
    lessonForPdf.lesson_number = `${lesson.lesson_number}`;
    lessonForPdf.originalTitle = lesson.title;
    lessonForPdf.versionName = version.version_name || `Version ${version.version_number}`;

    const filename = getPdfFileName(
      lesson.lesson_number,
      course.grade,
      course.discipline,
      version.version_number,
      version.version_name || `Version-${version.version_number}`
    );
    const storagePath = `${lessonId}/${filename}`;

    const pdfServiceUrl = process.env.PDF_SERVICE_URL;

    if (!pdfServiceUrl) {
      return NextResponse.json({ error: "PDF service not configured" }, { status: 500 });
    }

    const renderResponse = await fetch(`${pdfServiceUrl}/lesson-pdf`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lesson: lessonForPdf, course, isVersionPdf: true, lessonId }),
      signal: AbortSignal.timeout(120000),
    });

    let pdfBuffer: ArrayBuffer | null = null;

    if (renderResponse.status === 202) {
      const queueData = await renderResponse.json().catch(() => ({}));

      if (queueData.status === 'queued' || queueData.status === 'processing') {
        const requestId = queueData.requestId || lessonId;
        console.log(`[Version PDF] Service busy, polling for PDF (position: ${queueData.position})`);

        const maxPollAttempts = 60;
        const pollIntervalMs = 2000;

        for (let i = 0; i < maxPollAttempts; i++) {
          await new Promise(resolve => setTimeout(resolve, pollIntervalMs));

          const statusResponse = await fetch(`${pdfServiceUrl}/lesson-pdf-status?lessonId=${requestId}`);

          if (!statusResponse.ok) {
            console.error("Status poll error:", statusResponse.status);
            continue;
          }

          const contentType = statusResponse.headers.get('content-type');
          console.log(`[Version PDF] Poll ${i + 1}: Content-Type=${contentType}`);

          // Check if response is PDF binary (completed)
          if (contentType && contentType.includes('application/pdf')) {
            pdfBuffer = await statusResponse.arrayBuffer();
            console.log(`[Version PDF] PDF retrieved after ${i + 1} polls`);
            break;
          }

          // Parse JSON status response
          let statusData;
          try {
            statusData = await statusResponse.json();
          } catch (jsonError) {
            // If JSON parsing fails, might be an error page or corrupted response
            console.error(`[Version PDF] JSON parse failed: ${jsonError}`);
            continue;
          }

          if (statusData.status === 'failed') {
            return NextResponse.json(
              { error: "PDF generation failed", message: statusData.error },
              { status: 500 }
            );
          }

          if (i === maxPollAttempts - 1) {
            return NextResponse.json({ error: "PDF generation timed out waiting for queue" }, { status: 500 });
          }
        }
      }

      if (pdfBuffer === null) {
        pdfBuffer = await renderResponse.arrayBuffer();
      }
    } else if (!renderResponse.ok) {
      const errorText = await renderResponse.text();
      console.error("Render PDF service error:", errorText);

      return NextResponse.json(
        {
          error: "PDF generation failed at external service",
          diagnostics: {
            pdfServiceUrl,
            status: renderResponse.status,
            responsePreview: errorText.substring(0, 500),
          },
        },
        { status: 500 }
      );
    } else {
      pdfBuffer = await renderResponse.arrayBuffer();
    }
    const fileSize = pdfBuffer.byteLength;

    if (fileSize > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `PDF file too large (max ${MAX_FILE_SIZE / 1024 / 1024}MB)`, actualSize: fileSize },
        { status: 400 }
      );
    }

    const { error: removeError } = await supabaseAdmin.storage
      .from("lesson-version-pdfs")
      .remove([storagePath]);

    if (removeError) {
      console.log("Remove error (may not exist):", removeError.message);
    }

    const { error: uploadError } = await supabaseAdmin.storage
      .from("lesson-version-pdfs")
      .upload(storagePath, pdfBuffer, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      return NextResponse.json({ error: "Failed to upload PDF to storage" }, { status: 500 });
    }

    const { error: updateError } = await supabase
      .from("lesson_versions")
      .update({
        pdf_storage_path: storagePath,
        pdf_generated_at: new Date().toISOString(),
      })
      .eq("id", versionId);

    if (updateError) {
      console.error("Failed to update version with PDF path:", updateError);
    }

    const { error: usageUpsertError } = await supabase
      .from("lesson_version_pdf_usage")
      .upsert(
        {
          user_id: user.id,
          week_start: weekStartStr,
          pdf_count: currentCount + 1,
        },
        { onConflict: "user_id,week_start" }
      );

    if (usageUpsertError) {
      console.error("Failed to update PDF usage:", usageUpsertError);
    }

    return NextResponse.json({
      success: true,
      filename,
      file_size: fileSize,
      generated_at: new Date().toISOString(),
      pdf_count: currentCount + 1,
      limit: WEEKLY_PDF_LIMIT,
      remaining: WEEKLY_PDF_LIMIT - currentCount - 1,
    });
  } catch (error: any) {
    console.error("Version PDF generate error:", error);

    if (error.name === "TimeoutError") {
      return NextResponse.json({ error: "PDF generation timed out" }, { status: 500 });
    }

    return NextResponse.json({ error: error.message || "Failed to generate PDF" }, { status: 500 });
  }
}
