import { createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request, { params }: { params: Promise<{ courseId: string }> }) {
  try {
    const { courseId } = await params;
    const supabaseAdmin = await createServiceClient();

    const { data, error } = await supabaseAdmin
      .from("course_units")
      .select("*")
      .eq("course_id", courseId)
      .order("display_order", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ units: data });
  } catch (error: any) {
    console.error("Get course units error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ courseId: string }> }) {
  try {
    const { courseId } = await params;
    const supabaseAdmin = await createServiceClient();
    const body = await request.json();
    const { title, displayOrder } = body;

    if (!title || !title.trim()) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    let newDisplayOrder = displayOrder;

    if (newDisplayOrder === undefined) {
      const { data: maxData } = await supabaseAdmin
        .from("course_units")
        .select("display_order")
        .eq("course_id", courseId)
        .order("display_order", { ascending: false })
        .limit(1);

      const maxOrder = maxData && maxData.length > 0 ? maxData[0].display_order : 0;
      newDisplayOrder = maxOrder + 1;
    }

    const { data, error } = await supabaseAdmin
      .from("course_units")
      .insert({ course_id: courseId, title, display_order: newDisplayOrder })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ unit: data });
  } catch (error: any) {
    console.error("Create course unit error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
