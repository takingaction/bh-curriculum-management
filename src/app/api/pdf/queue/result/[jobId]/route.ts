import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;

    if (!jobId) {
      return NextResponse.json({ error: "Job ID required" }, { status: 400 });
    }

    const pdfServiceUrl = process.env.PDF_SERVICE_URL;

    if (!pdfServiceUrl) {
      return NextResponse.json(
        { error: "PDF service not configured" },
        { status: 500 }
      );
    }

    const response = await fetch(`${pdfServiceUrl}/queue/result/${jobId}`, {
      signal: AbortSignal.timeout(10000),
    });

    if (response.headers.get("content-type")?.includes("application/pdf")) {
      const buffer = await response.arrayBuffer();
      const filename = response.headers.get("content-disposition")?.split('filename="')[1]?.replace('"', '') || "document.pdf";

      return new Response(buffer, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Content-Length": buffer.byteLength.toString(),
        },
      });
    }

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data.error || "Failed to get job result" },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Queue result error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to get job result" },
      { status: 500 }
    );
  }
}
