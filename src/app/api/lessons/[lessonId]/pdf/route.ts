import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ lessonId: string }> }
) {
  try {
    const { lessonId } = await params;
    const { searchParams } = new URL(request.url);
    const download = searchParams.get("download") === "true";

    if (!lessonId) {
      return NextResponse.json({ error: "Lesson ID required" }, { status: 400 });
    }

    const supabase = await createClient();
    const supabaseAdmin = await createServiceClient();

    const { data: pdfData, error } = await supabase
      .from("lesson_pdfs")
      .select("storage_path, file_size, generated_at")
      .eq("lesson_id", lessonId)
      .single();

    if (error && error.code !== "PGRST116") {
      console.error("Error fetching PDF:", error);
      return NextResponse.json({ error: "Failed to fetch PDF" }, { status: 500 });
    }

    if (!pdfData) {
      return NextResponse.json({ error: "No PDF found for this lesson" }, { status: 404 });
    }

    const storagePath = pdfData.storage_path;
    const filename = storagePath.split("/").pop() || "lesson.pdf";

    const { data: fileData, error: fileError } = await supabaseAdmin.storage
      .from("lesson-pdfs")
      .download(storagePath);

    if (fileError || !fileData) {
      console.error("Error downloading from storage:", fileError);
      return NextResponse.json({ error: "Failed to download PDF from storage" }, { status: 500 });
    }

    const buffer = await fileData.arrayBuffer();

    const response = new Response(buffer, {
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

    return response;
  } catch (error: any) {
    console.error("PDF download error:", error);
    return NextResponse.json({ error: error.message || "Failed" }, { status: 500 });
  }
}
