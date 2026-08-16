import { NextResponse } from "next/server";

export async function DELETE(
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

    const response = await fetch(`${pdfServiceUrl}/queue/cancel/${jobId}`, {
      method: "DELETE",
      signal: AbortSignal.timeout(10000),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data.error || "Failed to cancel job" },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Queue cancel error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to cancel job" },
      { status: 500 }
    );
  }
}
