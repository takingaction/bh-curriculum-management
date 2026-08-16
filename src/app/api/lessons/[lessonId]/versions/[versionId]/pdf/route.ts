import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getPdfFileName, TEXT_FIELDS_LIST } from "@/lib/version-utils";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const inFlightJobs = new Map<string, Promise<string>>();

async function getOrCreateJob(lessonId: string, versionId: string, pdfServiceUrl: string, lessonForPdf: any, course: any): Promise<string> {
  const key = `${lessonId}:${versionId}`;
  const existing = inFlightJobs.get(key);
  if (existing) {
    console.log("[VersionPDF] Found existing in-flight job for", key, "- reusing");
    return existing;
  }

  console.log("[VersionPDF] Creating new job for", key);

  const submitJob = async (): Promise<string> => {
    const submitResponse = await fetch(`${pdfServiceUrl}/queue/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pdfType: "version",
        payload: { lesson: lessonForPdf, course, isVersionPdf: true },
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!submitResponse.ok) {
      const errorData = await submitResponse.json();
      throw new Error(errorData.error || "Failed to submit job to queue");
    }

    const { jobId } = await submitResponse.json();
    return jobId;
  };

  const jobPromise = submitJob();
  inFlightJobs.set(key, jobPromise);

  jobPromise.finally(() => {
    setTimeout(() => {
      const current = inFlightJobs.get(key);
      if (current === jobPromise) {
        inFlightJobs.delete(key);
      }
    }, 60000);
  });

  return jobPromise;
}

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
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  console.log("[VersionPDF] POST received, requestId:", requestId, "at", new Date().toISOString());
  try {
    const { lessonId, versionId } = await params;
    console.log("[VersionPDF][", requestId, "] params - lessonId:", lessonId, "versionId:", versionId);

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

    console.log("[VersionPDF][", requestId, "] Submitting job to queue...");
    const jobId = await getOrCreateJob(lessonId, versionId, pdfServiceUrl, lessonForPdf, course);
    console.log("[VersionPDF][", requestId, "] Job submitted to queue:", jobId);

    // Poll for completion
    const maxWaitTime = 120000;
    const pollInterval = 2000;
    const startTime = Date.now();
    let pdfBuffer: ArrayBuffer | null = null;

    while (Date.now() - startTime < maxWaitTime) {
      console.log("[VersionPDF][", requestId, "] Polling status for job:", jobId);
      const statusRes = await fetch(`${pdfServiceUrl}/queue/status/${jobId}`, {
        signal: AbortSignal.timeout(5000),
      });

      if (statusRes.ok) {
        const statusData = await statusRes.json();
        console.log("[VersionPDF][", requestId, "] Status response:", JSON.stringify(statusData));

        if (statusData.status === "completed") {
          console.log("[VersionPDF][", requestId, "] Job completed, fetching result for job:", jobId);
          const resultRes = await fetch(`${pdfServiceUrl}/queue/result/${jobId}`, {
            signal: AbortSignal.timeout(30000),
          });

          console.log("[VersionPDF][", requestId, "] Result response status:", resultRes.status);
          console.log("[VersionPDF][", requestId, "] Result content-type:", resultRes.headers.get("content-type"));

          if (resultRes.headers.get("content-type")?.includes("application/pdf")) {
            pdfBuffer = await resultRes.arrayBuffer();
            console.log("[VersionPDF][", requestId, "] PDF buffer received, size:", pdfBuffer.byteLength);
          } else {
            const resultText = await resultRes.text();
            console.log("[VersionPDF][", requestId, "] Result was NOT PDF, body:", resultText.substring(0, 500));
          }
          break;
        }

        if (statusData.status === "failed") {
          console.log("[VersionPDF][", requestId, "] Job failed:", statusData.error);
          return NextResponse.json(
            { error: statusData.error || "PDF generation failed" },
            { status: 500 }
          );
        }
      } else {
        console.log("[VersionPDF][", requestId, "] Status response not ok:", statusRes.status);
      }

      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }

    if (pdfBuffer === null) {
      console.log("[VersionPDF][", requestId, "] Timeout: pdfBuffer still null after polling");
      return NextResponse.json({ error: "PDF generation timed out" }, { status: 500 });
    }

    console.log("[VersionPDF][", requestId, "] PDF buffer ready, size:", pdfBuffer.byteLength);

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
      console.log("[VersionPDF][", requestId, "] Remove error (may not exist):", removeError.message);
    }

    console.log("[VersionPDF][", requestId, "] Uploading to storage, path:", storagePath, "size:", fileSize);
    const { error: uploadError } = await supabaseAdmin.storage
      .from("lesson-version-pdfs")
      .upload(storagePath, pdfBuffer, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadError) {
      console.error("[VersionPDF][", requestId, "] Storage upload error:", uploadError);
      return NextResponse.json({ error: "Failed to upload PDF to storage" }, { status: 500 });
    }

    console.log("[VersionPDF][", requestId, "] Storage upload successful, updating database...");
    const { error: updateError } = await supabase
      .from("lesson_versions")
      .update({
        pdf_storage_path: storagePath,
        pdf_generated_at: new Date().toISOString(),
      })
      .eq("id", versionId);

    if (updateError) {
      console.error("[VersionPDF][", requestId, "] Failed to update version with PDF path:", updateError);
    }

    console.log("[VersionPDF][", requestId, "] SUCCESS - PDF generated and uploaded");
    return NextResponse.json({
      success: true,
      filename,
      file_size: fileSize,
      generated_at: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("[VersionPDF][", requestId, "] Catch block error:", error);
    console.error("[VersionPDF][", requestId, "] Error stack:", error.stack);

    if (error.name === "TimeoutError") {
      return NextResponse.json({ error: "PDF generation timed out" }, { status: 500 });
    }

    return NextResponse.json({ error: error.message || "Failed to generate PDF" }, { status: 500 });
  }
}
