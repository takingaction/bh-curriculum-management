import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ lessonId: string }> }
) {
  const diagnostics: Record<string, any> = {
    timestamp: new Date().toISOString(),
    environment: {},
    auth: {},
    supabase: {},
    pdfService: {},
    lesson: null,
    error: null,
  };

  try {
    // Check environment variables
    diagnostics.environment = {
      NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      NEXT_PUBLIC_PDF_SERVICE_URL: process.env.NEXT_PUBLIC_PDF_SERVICE_URL || null,
      NODE_ENV: process.env.NODE_ENV,
    };

    // Test auth
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    diagnostics.auth = {
      userId: user?.id || null,
      email: user?.email || null,
      authError: authError?.message || null,
    };

    if (!user) {
      return NextResponse.json(diagnostics);
    }

    // Check profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .single();
    diagnostics.auth.role = profile?.role || null;
    diagnostics.auth.isAdmin = profile?.role === "admin";

    // Get lesson ID from params
    const { lessonId } = await params;
    diagnostics.lessonId = lessonId;

    if (!lessonId) {
      diagnostics.error = "No lesson ID provided";
      return NextResponse.json(diagnostics);
    }

    // Fetch lesson
    const supabaseAdmin = await createServiceClient();
    const { data: lesson, error: lessonError } = await supabaseAdmin
      .from("lessons")
      .select("*")
      .eq("id", lessonId)
      .single();

    if (lessonError) {
      diagnostics.lesson = { error: lessonError.message };
    } else {
      diagnostics.lesson = {
        id: lesson.id,
        lesson_number: lesson.lesson_number,
        title: lesson.title,
        course_id: lesson.course_id,
        hasContent: {
          lesson_outline: !!lesson.lesson_outline,
          learning_objectives: !!lesson.learning_objectives,
          vocabulary: !!lesson.vocabulary,
          materials: !!lesson.materials,
          vapa_text_block: !!lesson.vapa_text_block,
          ncas_text_block: !!lesson.ncas_text_block,
          welcome_opening: !!lesson.welcome_opening,
          actual_class_expectations: !!lesson.actual_class_expectations,
          lesson_hook: !!lesson.lesson_hook,
          warm_up: !!lesson.warm_up,
          main_activity: !!lesson.main_activity,
          instrument_expectations: !!lesson.instrument_expectations,
          reflection: !!lesson.reflection,
          closing_ceremony: !!lesson.closing_ceremony,
          assessment: !!lesson.assessment,
        },
      };

      // Fetch course
      const { data: course, error: courseError } = await supabaseAdmin
        .from("courses")
        .select("title, discipline, grade")
        .eq("id", lesson.course_id)
        .single();

      diagnostics.lesson.course = courseError ? { error: courseError.message } : course;
    }

    // Test PDF service connection
    const pdfServiceUrl = process.env.PDF_SERVICE_URL;
    diagnostics.pdfService.url = pdfServiceUrl;
    diagnostics.pdfService.urlExists = !!pdfServiceUrl;

    if (pdfServiceUrl) {
      // Test health endpoint
      try {
        const healthStart = Date.now();
        const healthRes = await fetch(`${pdfServiceUrl}/health`, {
          method: "GET",
          signal: AbortSignal.timeout(10000),
        });
        diagnostics.pdfService.health = {
          status: healthRes.status,
          ok: healthRes.ok,
          duration_ms: Date.now() - healthStart,
        };
      } catch (healthErr: any) {
        diagnostics.pdfService.health = {
          error: healthErr.message,
          name: healthErr.name,
        };
      }

      // Test lesson-pdf endpoint with minimal data
      try {
        const testLesson = {
          id: "test",
          lesson_number: 1,
          title: "Test Lesson",
          lesson_outline: "<p>Test content</p>",
        };
        const testCourse = {
          title: "Test Course",
          discipline: "Music",
          grade: "1",
        };

        const pdfStart = Date.now();
        const pdfRes = await fetch(`${pdfServiceUrl}/lesson-pdf`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lesson: testLesson, course: testCourse }),
          signal: AbortSignal.timeout(60000),
        });
        const pdfDuration = Date.now() - pdfStart;

        diagnostics.pdfService.lessonPdfTest = {
          status: pdfRes.status,
          statusText: pdfRes.statusText,
          ok: pdfRes.ok,
          duration_ms: pdfDuration,
          contentType: pdfRes.headers.get("content-type"),
          contentLength: pdfRes.headers.get("content-length"),
        };

        // Try to read as text to see what we get back
        const pdfText = await pdfRes.text();
        diagnostics.pdfService.lessonPdfTest.responsePreview = pdfText.substring(0, 500);

        // Check if it's a PDF (starts with %PDF)
        diagnostics.pdfService.lessonPdfTest.isPdf = pdfText.startsWith("%PDF");
        diagnostics.pdfService.lessonPdfTest.isHtml = pdfText.includes("<!DOCTYPE") || pdfText.includes("<html");
      } catch (pdfErr: any) {
        diagnostics.pdfService.lessonPdfTest = {
          error: pdfErr.message,
          name: pdfErr.name,
        };
      }
    }

    return NextResponse.json(diagnostics);
  } catch (error: any) {
    diagnostics.error = {
      message: error.message,
      stack: error.stack,
      name: error.name,
    };
    return NextResponse.json(diagnostics, { status: 500 });
  }
}
