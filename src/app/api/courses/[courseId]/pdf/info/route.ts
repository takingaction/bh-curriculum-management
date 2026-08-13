import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    const { courseId } = await params;

    if (!courseId) {
      return NextResponse.json({ error: "Course ID required" }, { status: 400 });
    }

    const supabase = await createClient();

    const { data: pdfData, error } = await supabase
      .from("course_pdfs")
      .select("storage_path, file_size, generated_at")
      .eq("course_id", courseId)
      .single();

    if (error && error.code !== "PGRST116") {
      console.error("Error fetching course PDF:", error);
      return NextResponse.json({ error: "Failed to fetch PDF metadata" }, { status: 500 });
    }

    if (!pdfData) {
      return NextResponse.json({ exists: false });
    }

    return NextResponse.json({
      exists: true,
      generated_at: pdfData.generated_at,
      file_size: pdfData.file_size,
      filename: pdfData.storage_path?.split("/").pop() || "scope-and-sequence.pdf"
    });
  } catch (error: any) {
    console.error("Course PDF info error:", error);
    return NextResponse.json({ error: error.message || "Failed" }, { status: 500 });
  }
}
