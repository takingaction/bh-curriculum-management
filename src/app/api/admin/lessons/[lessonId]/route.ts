import { createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ lessonId: string }> }
) {
  const { lessonId } = await params;
  const supabase = await createServiceClient();

  const { data: lesson, error } = await supabase
    .from("lessons")
    .select("*")
    .eq("id", lessonId)
    .single();

  if (error || !lesson) {
    return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
  }

  return NextResponse.json(lesson);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ lessonId: string }> }
) {
  const { lessonId } = await params;
  const supabase = await createServiceClient();
  const body = await request.json();

  const { data: lesson, error } = await supabase
    .from("lessons")
    .update(body)
    .eq("id", lessonId)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(lesson);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ lessonId: string }> }
) {
  const { lessonId } = await params;
  const supabase = await createServiceClient();

  const { error } = await supabase
    .from("lessons")
    .delete()
    .eq("id", lessonId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}