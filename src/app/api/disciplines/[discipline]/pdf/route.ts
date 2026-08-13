import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ discipline: string }> }
) {
  try {
    const { discipline } = await params;
    const { searchParams } = new URL(request.url);
    const download = searchParams.get("download") === "true";

    if (!discipline) {
      return NextResponse.json({ error: "Discipline required" }, { status: 400 });
    }

    const supabaseAdmin = await createServiceClient();

    const { data: pdfData, error } = await supabaseAdmin
      .from("discipline_pdfs")
      .select("storage_path, file_size, generated_at")
      .eq("discipline", discipline)
      .single();

    if (error && error.code !== "PGRST116") {
      console.error("Error fetching discipline PDF:", error);
      return NextResponse.json({ error: "Failed to fetch PDF" }, { status: 500 });
    }

    if (!pdfData) {
      return NextResponse.json({ error: "No PDF found for this discipline" }, { status: 404 });
    }

    const storagePath = pdfData.storage_path;
    const filename = storagePath?.split("/").pop() || `${discipline.toLowerCase()}-scope-and-sequence.pdf`;

    const { data: fileData, error: fileError } = await supabaseAdmin.storage
      .from("discipline-pdfs")
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
  } catch (error) {
    console.error("Discipline PDF download error:", error);
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
