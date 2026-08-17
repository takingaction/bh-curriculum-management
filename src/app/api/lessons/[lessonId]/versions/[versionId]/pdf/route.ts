import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getPdfFileName, TEXT_FIELDS_LIST } from "@/lib/version-utils";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

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

    let renderResponse;
    try {
      renderResponse = await fetch(`${pdfServiceUrl}/lesson-pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lesson: lessonForPdf, course, isVersionPdf: true }),
        signal: AbortSignal.timeout(120000),
      });
    } catch (fetchError: any) {
      console.error("VersionPDF: Fetch to PDF service failed:", fetchError.message);
      const diagnostics: Record<string, any> = {
        pdfServiceUrl,
        errorType: fetchError.name || "FetchError",
        errorMessage: fetchError.message,
        code: fetchError.code,
      };

      if (fetchError.cause) {
        diagnostics.cause = fetchError.cause.message || fetchError.cause;
      }

      if (fetchError.message?.includes("ECONNREFUSED")) {
        diagnostics.hint = "PDF service is not running or unreachable";
      } else if (fetchError.message?.includes("ETIMEDOUT")) {
        diagnostics.hint = "Connection to PDF service timed out";
      } else if (fetchError.name === "TimeoutError") {
        diagnostics.hint = "PDF service request timed out after 120 seconds";
      }

      return NextResponse.json(
        {
          error: "Failed to connect to PDF service",
          diagnostics,
        },
        { status: 500 }
      );
    }

    let pdfBuffer: ArrayBuffer | null = null;

    if (!renderResponse.ok) {
      const errorText = await renderResponse.text();
      console.error("VersionPDF: Render service error:", errorText);
      console.error("VersionPDF: Render service status:", renderResponse.status);

      let errorData: any = {};
      try {
        errorData = JSON.parse(errorText);
      } catch {
        // Not JSON, use text
      }

      const diagnostics: Record<string, any> = {
        pdfServiceUrl,
        status: renderResponse.status,
        statusText: renderResponse.statusText,
        responseContentType: renderResponse.headers.get("content-type"),
      };

      if (errorData.error) {
        diagnostics.serviceError = errorData.error;
        diagnostics.serviceMessage = errorData.message;
      }

      diagnostics.responseBody = errorText.substring(0, 1000);

      const isHtml = errorText.includes("<!DOCTYPE") || errorText.includes("<html");
      if (isHtml) {
        diagnostics.isHtmlError = true;
        const titleMatch = errorText.match(/<title>(.*?)<\/title>/i);
        const preMatch = errorText.match(/<pre>([\s\S]*?)<\/pre>/i);
        diagnostics.htmlError = {
          title: titleMatch ? titleMatch[1] : null,
          message: preMatch ? preMatch[1] : null,
        };
      }

      return NextResponse.json(
        {
          error: errorData.error || "PDF generation failed at external service",
          diagnostics,
        },
        { status: 500 }
      );
    }

    const contentType = renderResponse.headers.get("content-type");
    if (contentType && contentType.includes("application/pdf")) {
      pdfBuffer = await renderResponse.arrayBuffer();
    }

    if (pdfBuffer === null) {
      console.error("VersionPDF: Response was not PDF, content-type:", contentType);
      return NextResponse.json(
        {
          error: "PDF service returned unexpected response",
          diagnostics: {
            pdfServiceUrl,
            contentType: contentType || "not set",
            expectedContentType: "application/pdf",
          },
        },
        { status: 500 }
      );
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
      console.error("VersionPDF: Storage upload error:", uploadError);
      return NextResponse.json(
        {
          error: "Failed to upload PDF to storage",
          diagnostics: {
            error: uploadError.message,
            errorCode: uploadError.statusCode,
            storagePath,
            fileSize,
          },
        },
        { status: 500 }
      );
    }

    const { error: updateError } = await supabase
      .from("lesson_versions")
      .update({
        pdf_storage_path: storagePath,
        pdf_generated_at: new Date().toISOString(),
      })
      .eq("id", versionId);

    if (updateError) {
      console.error("VersionPDF: Database update error:", updateError);
    }

    return NextResponse.json({
      success: true,
      filename,
      file_size: fileSize,
      generated_at: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("VersionPDF: Unexpected error:", error.message || error);
    console.error("VersionPDF: Error stack:", error.stack);

    const diagnostics: Record<string, any> = {
      errorType: error.name || "Error",
      errorMessage: error.message || String(error),
    };

    if (error.name === "TimeoutError") {
      diagnostics.hint = "Request to PDF service timed out after 120 seconds";
    }

    if (error.cause) {
      diagnostics.cause = error.cause.message || error.cause;
    }

    return NextResponse.json(
      {
        error: error.message || "Failed to generate PDF",
        diagnostics,
      },
      { status: 500 }
    );
  }
}
