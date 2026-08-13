import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const gradeOrder = ["PK", "K", "1", "2", "3", "4", "5", "6"];

function sortByGrade(a: { grade: string }, b: { grade: string }) {
  const aIndex = gradeOrder.indexOf(a.grade);
  const bIndex = gradeOrder.indexOf(b.grade);
  if (aIndex === -1 && bIndex === -1) return a.grade.localeCompare(b.grade);
  if (aIndex === -1) return 1;
  if (bIndex === -1) return -1;
  return aIndex - bIndex;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ discipline: string }> }
) {
  try {
    const { discipline } = await params;

    if (!discipline) {
      return NextResponse.json({ error: "Discipline required" }, { status: 400 });
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

    // Fetch all courses for this discipline
    const { data: courses, error: coursesError } = await supabase
      .from("courses")
      .select("id, title, discipline, grade, summary")
      .eq("discipline", discipline)
      .order("grade");

    if (coursesError) {
      console.error("Error fetching courses:", coursesError);
      return NextResponse.json({ error: "Failed to fetch courses" }, { status: 500 });
    }

    if (!courses || courses.length === 0) {
      return NextResponse.json({ error: "No courses found for this discipline" }, { status: 404 });
    }

    // Sort by grade
    const sortedCourses = [...courses].sort(sortByGrade);

    const storagePath = `${discipline.toLowerCase()}/scope-and-sequence.pdf`;

    // Call Render PDF service
    const pdfServiceUrl = process.env.PDF_SERVICE_URL;

    if (!pdfServiceUrl) {
      return NextResponse.json({ error: "PDF service not configured" }, { status: 500 });
    }

    console.log("Generating discipline PDF for:", discipline);
    console.log("Number of courses:", sortedCourses.length);

    const renderResponse = await fetch(`${pdfServiceUrl}/discipline-pdf`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courses: sortedCourses, discipline }),
      signal: AbortSignal.timeout(120000), // 2 minute timeout
    });

    if (!renderResponse.ok) {
      const errorText = await renderResponse.text();
      console.error("Render PDF service error:", errorText);

      const diagnostics: Record<string, unknown> = {
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
    const contentType = renderResponse.headers.get("content-type") || "unknown";

    console.log("Discipline PDF received - Content-Type:", contentType);
    console.log("Discipline PDF received - Actual byteLength:", fileSize);

    // Check file size limit
    if (fileSize > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `PDF file too large (max ${MAX_FILE_SIZE / 1024 / 1024}MB)`, actualSize: fileSize },
        { status: 400 }
      );
    }

    // Upload to Supabase Storage
    console.log("Uploading Discipline PDF to storage:", storagePath, "Size:", fileSize);

    // Delete existing file first, then upload fresh
    const { error: removeError } = await supabaseAdmin.storage
      .from("discipline-pdfs")
      .remove([storagePath]);

    if (removeError) {
      console.log("Remove error (may not exist):", removeError.message);
    }

    const { error: uploadError } = await supabaseAdmin.storage
      .from("discipline-pdfs")
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

    // Upsert record in discipline_pdfs table
    const { error: upsertError } = await supabaseAdmin
      .from("discipline_pdfs")
      .upsert({
        discipline: discipline,
        storage_path: storagePath,
        file_size: fileSize,
        generated_at: new Date().toISOString(),
        generated_by: user.id,
      }, {
        onConflict: "discipline",
      });

    if (upsertError) {
      console.error("Database upsert error:", upsertError);
      return NextResponse.json({ error: "Failed to save PDF metadata" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      filename: `${discipline.toLowerCase()}-scope-and-sequence.pdf`,
      file_size: fileSize,
      generated_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Discipline PDF generate error:", error);

    if (error instanceof Error && error.name === "TimeoutError") {
      return NextResponse.json({ error: "PDF generation timed out" }, { status: 500 });
    }

    const message = error instanceof Error ? error.message : "Failed to generate PDF";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
