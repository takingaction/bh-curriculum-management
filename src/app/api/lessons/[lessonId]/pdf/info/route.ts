import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ lessonId: string }> }
) {
  try {
    const { lessonId } = await params;

    if (!lessonId) {
      return NextResponse.json({ error: "Lesson ID required" }, { status: 400 });
    }

    const supabase = await createClient();

    const { data: pdfData, error } = await supabase
      .from("lesson_pdfs")
      .select("storage_path, file_size, generated_at")
      .eq("lesson_id", lessonId)
      .single();

    if (error && error.code !== "PGRST116") {
      console.error("Error fetching PDF info:", error);
      return NextResponse.json({ error: "Failed to fetch PDF info" }, { status: 500 });
    }

    if (!pdfData) {
      return NextResponse.json({ exists: false });
    }

    return NextResponse.json({
      exists: true,
      generated_at: pdfData.generated_at,
      file_size: pdfData.file_size,
      storage_path: pdfData.storage_path,
    });
  } catch (error: any) {
    console.error("PDF info error:", error);
    return NextResponse.json({ error: error.message || "Failed" }, { status: 500 });
  }
}
