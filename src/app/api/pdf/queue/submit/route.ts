import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { pdfType, payload, priority } = body;

    if (!pdfType || !payload) {
      return NextResponse.json(
        { error: "pdfType and payload are required" },
        { status: 400 }
      );
    }

    const pdfServiceUrl = process.env.PDF_SERVICE_URL;

    if (!pdfServiceUrl) {
      return NextResponse.json(
        { error: "PDF service not configured" },
        { status: 500 }
      );
    }

    const response = await fetch(`${pdfServiceUrl}/queue/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pdfType, payload, priority }),
      signal: AbortSignal.timeout(60000),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data.error || "Failed to submit job to queue" },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Queue submit error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to submit job to queue" },
      { status: 500 }
    );
  }
}
