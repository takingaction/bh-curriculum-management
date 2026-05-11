import { NextResponse } from "next/server";

interface LessonData {
  title: string;
  lesson_number: number;
  total_time?: string;
  lesson_outline?: string;
  learning_objectives?: string;
  vocabulary?: string;
  materials?: string;
  vapa_text_block?: string;
  ncas_text_block?: string;
  welcome_opening?: string;
  actual_class_expectations?: string;
  lesson_hook?: string;
  warm_up?: string;
  main_activity?: string;
  instrument_expectations?: string;
  reflection?: string;
  closing_ceremony?: string;
  assessment?: string;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { lesson, adapted = false } = body as { lesson: LessonData; adapted?: boolean };

    if (!lesson || !lesson.title) {
      return NextResponse.json(
        { error: "Invalid lesson data" },
        { status: 400 }
      );
    }

    const pdfServiceUrl = process.env.NEXT_PUBLIC_PDF_SERVICE_URL;

    if (pdfServiceUrl && pdfServiceUrl !== "/api/pdf/generate") {
      const response = await fetch(`${pdfServiceUrl}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lesson, adapted }),
      });

      if (!response.ok) {
        throw new Error("PDF service returned error");
      }

      const pdfBuffer = await response.arrayBuffer();
      return new Response(pdfBuffer, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${lesson.title.replace(/[^a-z0-9]/gi, "_")}.pdf"`,
        },
      });
    }

    const html = generateLessonHTML(lesson, adapted);

    return NextResponse.json({
      success: true,
      message: "Mock PDF endpoint - in production this returns actual PDF",
      lesson_title: lesson.title,
      adapted,
      html_preview: html,
      pdf_url: null,
      production_url: "Configure NEXT_PUBLIC_PDF_SERVICE_URL to enable real PDF generation",
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to generate PDF" },
      { status: 500 }
    );
  }
}

function generateLessonHTML(lesson: LessonData, adapted: boolean): string {
  const fields = [
    { key: "lesson_outline", label: "Lesson Outline" },
    { key: "learning_objectives", label: "Learning Objectives" },
    { key: "vocabulary", label: "Vocabulary" },
    { key: "materials", label: "Materials" },
    { key: "vapa_text_block", label: "VAPA Standards" },
    { key: "ncas_text_block", label: "NCAS Standards" },
    { key: "welcome_opening", label: "Welcome & Opening" },
    { key: "actual_class_expectations", label: "Class Expectations" },
    { key: "lesson_hook", label: "Lesson Hook" },
    { key: "warm_up", label: "Warm Up" },
    { key: "main_activity", label: "Main Activity" },
    { key: "instrument_expectations", label: "Instrument Expectations" },
    { key: "reflection", label: "Reflection" },
    { key: "closing_ceremony", label: "Closing Ceremony" },
    { key: "assessment", label: "Assessment" },
  ];

  const content = fields
    .filter((f) => lesson[f.key as keyof LessonData])
    .map(
      (f) => `
      <div class="field">
        <h3>${f.label}</h3>
        <div class="content">${lesson[f.key as keyof LessonData]}</div>
      </div>
    `
    )
    .join("");

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <title>${lesson.title}</title>
        <style>
          body { font-family: 'Inter', -apple-system, sans-serif; color: #2d2d2d; max-width: 800px; margin: 0 auto; padding: 40px; }
          h1 { color: #0d7377; }
          .badge { background: ${adapted ? "#e85d5d" : "#0d7377"}; color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px; display: inline-block; margin-bottom: 20px; }
          .field { margin-bottom: 24px; border-bottom: 1px solid #e5e5e0; padding-bottom: 16px; }
          .field h3 { color: #0d7377; margin-bottom: 8px; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; }
          .field .content { white-space: pre-wrap; line-height: 1.6; }
          .meta { color: #666; font-size: 14px; margin-bottom: 30px; }
        </style>
      </head>
      <body>
        <span class="badge">${adapted ? "AI-Adapted Version" : "Performers Ready! Curriculum"}</span>
        <h1>Lesson ${lesson.lesson_number}: ${lesson.title}</h1>
        <p class="meta">Duration: ${lesson.total_time || "Not specified"}</p>
        ${content}
      </body>
    </html>
  `;
}