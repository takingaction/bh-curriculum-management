import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);

    const type = searchParams.get("type");
    const courseId = searchParams.get("courseId");
    const lessonId = searchParams.get("lessonId");

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    if (type === "course" && courseId) {
      const { data, error } = await supabase
        .from("teacher_course_notes")
        .select("notes, updated_at")
        .eq("teacher_id", user.id)
        .eq("course_id", courseId)
        .single();

      if (error && error.code !== "PGRST116") {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ notes: data?.notes || "", updatedAt: data?.updated_at || null });
    }

    if (type === "lesson" && lessonId) {
      const { data, error } = await supabase
        .from("teacher_lesson_notes")
        .select("notes, updated_at")
        .eq("teacher_id", user.id)
        .eq("lesson_id", lessonId)
        .single();

      if (error && error.code !== "PGRST116") {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ notes: data?.notes || "", updatedAt: data?.updated_at || null });
    }

    return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const supabase = await createClient();
    const body = await request.json();

    const { type, courseId, lessonId, notes } = body;

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    if (!type || (type !== "course" && type !== "lesson")) {
      return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }

    if (notes === undefined) {
      return NextResponse.json({ error: "Notes content is required" }, { status: 400 });
    }

    if (type === "course" && courseId) {
      const { data, error } = await supabase
        .from("teacher_course_notes")
        .upsert({
          teacher_id: user.id,
          course_id: courseId,
          notes,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: "teacher_id,course_id",
        })
        .select("notes, updated_at")
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, notes: data.notes, updatedAt: data.updated_at });
    }

    if (type === "lesson" && lessonId) {
      const { data, error } = await supabase
        .from("teacher_lesson_notes")
        .upsert({
          teacher_id: user.id,
          lesson_id: lessonId,
          notes,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: "teacher_id,lesson_id",
        })
        .select("notes, updated_at")
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, notes: data.notes, updatedAt: data.updated_at });
    }

    return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
