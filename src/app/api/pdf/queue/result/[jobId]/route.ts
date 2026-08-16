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

    console.log("[QueueResult] Fetching result for jobId:", jobId);
    const response = await fetch(`${pdfServiceUrl}/queue/result/${jobId}`, {
      signal: AbortSignal.timeout(10000),
    });

    console.log("[QueueResult] Response status:", response.status);
    console.log("[QueueResult] Content-type:", response.headers.get("content-type"));

    if (response.headers.get("content-type")?.includes("application/pdf")) {
      const buffer = await response.arrayBuffer();
      console.log("[QueueResult] PDF buffer size:", buffer.byteLength);
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
    console.log("[QueueResult] Response was not PDF, body:", JSON.stringify(data).substring(0, 500));

    if (!response.ok) {
      return NextResponse.json(
        { error: data.error || "Failed to get job result" },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("[QueueResult] Error:", error);
    console.error("[QueueResult] Error stack:", error.stack);
    return NextResponse.json(
      { error: error.message || "Failed to get job result" },
      { status: 500 }
    );
  }
}
