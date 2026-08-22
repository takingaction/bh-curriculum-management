import { createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function PATCH(request: Request, { params }: { params: Promise<{ courseId: string; unitId: string }> }) {
  try {
    const { courseId, unitId } = await params;
    const supabaseAdmin = await createServiceClient();
    const body = await request.json();
    const { title } = body;

    if (title !== undefined && !title.trim()) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    const updateData: { title?: string; updated_at?: string } = {};
    if (title !== undefined) {
      updateData.title = title;
    }

    const { data, error } = await supabaseAdmin
      .from("course_units")
      .update(updateData)
      .eq("id", unitId)
      .eq("course_id", courseId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: "Unit not found" }, { status: 404 });
    }

    return NextResponse.json({ unit: data });
  } catch (error: any) {
    console.error("Update course unit error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ courseId: string; unitId: string }> }) {
  try {
    const { courseId, unitId } = await params;
    const supabaseAdmin = await createServiceClient();

    const { error } = await supabaseAdmin
      .from("course_units")
      .delete()
      .eq("id", unitId)
      .eq("course_id", courseId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Delete course unit error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
