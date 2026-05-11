import { createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const supabase = await createServiceClient();
    const { title, discipline, grade }: { title: string; discipline: string; grade: string } = await request.json();

    const { data: course, error } = await supabase
      .from("courses")
      .select("id")
      .eq("title", title)
      .eq("discipline", discipline)
      .eq("grade", grade)
      .single();

    if (error && error.code !== "PGRST116") {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      exists: !!course,
      courseId: course?.id || null
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}