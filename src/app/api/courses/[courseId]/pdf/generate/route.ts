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

    const { data: course, error: courseError } = await supabase
      .from("courses")
      .select("*")
      .eq("id", courseId)
      .single();

    if (courseError || !course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    const { data: lessons, error: lessonsError } = await supabase
      .from("lessons")
      .select("id, lesson_number, title, learning_objectives, display_order")
      .eq("course_id", courseId)
      .order("display_order", { ascending: true });

    if (lessonsError) {
      console.error("Error fetching lessons:", lessonsError);
      return NextResponse.json({ error: "Failed to fetch lessons" }, { status: 500 });
    }

    const { data: units, error: unitsError } = await supabase
      .from("course_units")
      .select("*")
      .eq("course_id", courseId)
      .order("display_order", { ascending: true });

    if (unitsError) {
      console.error("Error fetching units:", unitsError);
    }

    const storagePath = `${courseId}/scope-and-sequence.pdf`;

    const pdfServiceUrl = process.env.PDF_SERVICE_URL;

    if (!pdfServiceUrl) {
      return NextResponse.json({ error: "PDF service not configured" }, { status: 500 });
    }

    console.log("Generating course PDF for:", course.title);
    console.log("Number of lessons:", lessons?.length || 0);

    const renderResponse = await fetch(`${pdfServiceUrl}/course-pdf`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ course, lessons, units }),
      signal: AbortSignal.timeout(120000),
    });

    if (!renderResponse.ok) {
      const errorText = await renderResponse.text();
      console.error("Render PDF service error:", errorText);

      const diagnostics: Record<string, any> = {
        pdfServiceUrl: pdfServiceUrl,
        pdfServiceResponded: true,
        status: renderResponse.status,
        statusText: renderResponse.statusText,
        responseContentType: renderResponse.headers.get("content-type"),
        responsePreview: errorText.substring(0, 1000),
      };

      const isHtml = errorText.includes("<!DOCTYPE") || errorText.includes("<html");
      const isJson = errorText.trim().startsWith("{");
      diagnostics.isHtmlError = isHtml;
      diagnostics.isJsonError = isJson;

      if (isHtml) {
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

    if (fileSize > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `PDF file too large (max ${MAX_FILE_SIZE / 1024 / 1024}MB)`, actualSize: fileSize },
        { status: 400 }
      );
    }

    console.log("Uploading Course PDF to storage:", storagePath, "Size:", fileSize);

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
        fileSize,
      }, { status: 500 });
    }

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
