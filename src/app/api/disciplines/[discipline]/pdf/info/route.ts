import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ discipline: string }> }
) {
  try {
    const { discipline } = await params;

    if (!discipline) {
      return NextResponse.json({ error: "Discipline required" }, { status: 400 });
    }

    const supabase = await createClient();

    const { data: pdfData, error } = await supabase
      .from("discipline_pdfs")
      .select("storage_path, file_size, generated_at")
      .eq("discipline", discipline)
      .single();

    if (error && error.code !== "PGRST116") {
      console.error("Error fetching discipline PDF:", error);
      return NextResponse.json({ error: "Failed to fetch PDF metadata" }, { status: 500 });
    }

    if (!pdfData) {
      return NextResponse.json({ exists: false });
    }

    return NextResponse.json({
      exists: true,
      generated_at: pdfData.generated_at,
      file_size: pdfData.file_size,
      filename: pdfData.storage_path?.split("/").pop() || `${discipline.toLowerCase()}-scope-and-sequence.pdf`
    });
  } catch (error) {
    console.error("Discipline PDF info error:", error);
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
