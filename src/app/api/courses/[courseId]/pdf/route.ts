import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    const { courseId } = await params;
    const { searchParams } = new URL(request.url);
    const download = searchParams.get("download") === "true";

    if (!courseId) {
      return NextResponse.json({ error: "Course ID required" }, { status: 400 });
    }

    const supabase = await createClient();
    const supabaseAdmin = await createServiceClient();

    const { data: pdfData, error } = await supabase
      .from("course_pdfs")
      .select("storage_path, file_size, generated_at")
      .eq("course_id", courseId)
      .single();

    if (error && error.code !== "PGRST116") {
      console.error("Error fetching course PDF:", error);
      return NextResponse.json({ error: "Failed to fetch PDF" }, { status: 500 });
    }

    if (!pdfData) {
      return NextResponse.json({ error: "No PDF found for this course" }, { status: 404 });
    }

    const storagePath = pdfData.storage_path;
    const filename = storagePath.split("/").pop() || "scope-and-sequence.pdf";

    const { data: fileData, error: fileError } = await supabaseAdmin.storage
      .from("course-pdfs")
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
    console.error("Course PDF download error:", error);
    return NextResponse.json({ error: error.message || "Failed" }, { status: 500 });
  }
}
