import { NextResponse } from "next/server";
import { Document, Packer, Paragraph, TextRun } from "docx";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { content, format } = body;

    if (!content) {
      return NextResponse.json({ error: "Missing content" }, { status: 400 });
    }

    if (format === "docx") {
      const lines = content.split("\n");
      const paragraphs: Paragraph[] = [];

      for (const line of lines) {
        if (line.trim() === "") {
          paragraphs.push(new Paragraph({ text: "" }));
        } else if (line.startsWith("# ")) {
          paragraphs.push(
            new Paragraph({
              children: [new TextRun({ text: line.substring(2), bold: true, size: 32 })],
            })
          );
        } else if (line.startsWith("## ")) {
          paragraphs.push(
            new Paragraph({
              children: [new TextRun({ text: line.substring(3), bold: true, size: 28 })],
            })
          );
        } else if (line.startsWith("### ")) {
          paragraphs.push(
            new Paragraph({
              children: [new TextRun({ text: line.substring(4), bold: true, size: 24 })],
            })
          );
        } else {
          const cleanLine = line
            .replace(/\*\*(.*?)\*\*/g, "$1")
            .replace(/\*(.*?)\*/g, "$1")
            .replace(/`(.*?)`/g, "$1")
            .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");

          paragraphs.push(
            new Paragraph({
              children: [new TextRun({ text: cleanLine, size: 22 })],
            })
          );
        }
      }

      const doc = new Document({
        sections: [
          {
            properties: {},
            children: paragraphs,
          },
        ],
      });

      const buffer = await Packer.toBuffer(doc);
      const uint8Array = new Uint8Array(buffer);

      return new NextResponse(uint8Array, {
        status: 200,
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "Content-Disposition": "attachment; filename=ai-response.docx",
        },
      });
    }

    return NextResponse.json({ error: "Unsupported format" }, { status: 400 });
  } catch (error) {
    console.error("Export error:", error);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}
