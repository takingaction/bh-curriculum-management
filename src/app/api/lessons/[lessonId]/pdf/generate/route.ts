import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

function formatFilename(grade: string, discipline: string, lessonNumber: number): string {
  return `${grade}-${discipline}-L${lessonNumber}.pdf`;
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
      .select("title, discipline, grade, image_url")
      .eq("id", lesson.course_id)
      .single();

    if (courseError || !course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    // Generate filename
    const filename = formatFilename(course.grade, course.discipline, lesson.lesson_number);
    const storagePath = `${lessonId}/${filename}`;

    // Call Render PDF service
    const pdfServiceUrl = process.env.PDF_SERVICE_URL;

    if (!pdfServiceUrl) {
      return NextResponse.json({ error: "PDF service not configured" }, { status: 500 });
    }

    const renderResponse = await fetch(`${pdfServiceUrl}/lesson-pdf`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lesson, course }),
      signal: AbortSignal.timeout(120000), // 2 minute timeout
    });

    if (!renderResponse.ok) {
      const errorText = await renderResponse.text();
      console.error("Render PDF service error:", errorText);

      // Gather diagnostic info
      const diagnostics: Record<string, any> = {
        pdfServiceUrl: pdfServiceUrl,
        pdfServiceResponded: true,
        status: renderResponse.status,
        statusText: renderResponse.statusText,
        responseContentType: renderResponse.headers.get("content-type"),
        responsePreview: errorText.substring(0, 1000),
      };

      // Determine if it's HTML (error page) vs JSON
      const isHtml = errorText.includes("<!DOCTYPE") || errorText.includes("<html");
      const isJson = errorText.trim().startsWith("{");
      diagnostics.isHtmlError = isHtml;
      diagnostics.isJsonError = isJson;

      if (isHtml) {
        // Try to extract error message from HTML
        const titleMatch = errorText.match(/<title>(.*?)<\/title>/i);
        const preMatch = errorText.match(/<pre>([\s\S]*?)<\/pre>/i);
        diagnostics.htmlError = {
          title: titleMatch ? titleMatch[1] : null,
          message: preMatch ? preMatch[1] : null,
        };
      }

      return NextResponse.json(
        {
          error: "PDF generation failed at external service",
          diagnostics,
        },
        { status: 500 }
      );
    }

    const pdfBuffer = await renderResponse.arrayBuffer();
    const fileSize = pdfBuffer.byteLength;

    // Check file size limit
    if (fileSize > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `PDF file too large (max ${MAX_FILE_SIZE / 1024 / 1024}MB)` },
        { status: 400 }
      );
    }

    // Upload to Supabase Storage
    console.log("Uploading PDF to storage:", storagePath, "Size:", fileSize);
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

    // Delete old PDF if exists and different path
    const { data: oldPdf } = await supabase
      .from("lesson_pdfs")
      .select("storage_path")
      .eq("lesson_id", lessonId)
      .single();

    if (oldPdf && oldPdf.storage_path !== storagePath) {
      await supabaseAdmin.storage
        .from("lesson-pdfs")
        .remove([oldPdf.storage_path]);
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
