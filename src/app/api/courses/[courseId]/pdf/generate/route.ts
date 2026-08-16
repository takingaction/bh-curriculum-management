import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export async function POST(
  request: Request,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    const { courseId } = await params;

    if (!courseId) {
      return NextResponse.json({ error: "Course ID required" }, { status: 400 });
    }

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

    // Fetch course data
    const { data: course, error: courseError } = await supabase
      .from("courses")
      .select("*")
      .eq("id", courseId)
      .single();

    if (courseError || !course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    // Fetch all lessons for this course
    const { data: lessons, error: lessonsError } = await supabase
      .from("lessons")
      .select("id, lesson_number, title, learning_objectives")
      .eq("course_id", courseId)
      .order("lesson_number");

    if (lessonsError) {
      console.error("Error fetching lessons:", lessonsError);
      return NextResponse.json({ error: "Failed to fetch lessons" }, { status: 500 });
    }

    const storagePath = `${courseId}/scope-and-sequence.pdf`;

    // Call Render PDF service - submit to queue for priority processing
    const pdfServiceUrl = process.env.PDF_SERVICE_URL;

    if (!pdfServiceUrl) {
      return NextResponse.json({ error: "PDF service not configured" }, { status: 500 });
    }

    console.log("Generating course PDF for:", course.title);
    console.log("Number of lessons:", lessons?.length || 0);

    // Submit to queue
    const submitResponse = await fetch(`${pdfServiceUrl}/queue/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pdfType: "course",
        payload: { course, lessons },
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
    console.log("Course PDF received - byteLength:", fileSize);

    // Check file size limit
    if (fileSize > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `PDF file too large (max ${MAX_FILE_SIZE / 1024 / 1024}MB)`, actualSize: fileSize },
        { status: 400 }
      );
    }

    // Upload to Supabase Storage
    console.log("Uploading Course PDF to storage:", storagePath, "Size:", fileSize);

    // Delete existing file first, then upload fresh
    const { error: removeError } = await supabaseAdmin.storage
      .from("course-pdfs")
      .remove([storagePath]);

    if (removeError) {
      console.log("Remove error (may not exist):", removeError.message);
    }

    const { error: uploadError } = await supabaseAdmin.storage
      .from("course-pdfs")
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

    // Upsert record in course_pdfs table
    const { error: upsertError } = await supabaseAdmin
      .from("course_pdfs")
      .upsert({
        course_id: courseId,
        storage_path: storagePath,
        file_size: fileSize,
        generated_at: new Date().toISOString(),
        generated_by: user.id,
      }, {
        onConflict: "course_id",
      });

    if (upsertError) {
      console.error("Database upsert error:", upsertError);
      return NextResponse.json({ error: "Failed to save PDF metadata" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      filename: "scope-and-sequence.pdf",
      file_size: fileSize,
      generated_at: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("Course PDF generate error:", error);

    if (error.name === "TimeoutError") {
      return NextResponse.json({ error: "PDF generation timed out" }, { status: 500 });
    }

    return NextResponse.json({ error: error.message || "Failed to generate PDF" }, { status: 500 });
  }
}
