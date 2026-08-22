import { createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

interface ReorderItem {
  type: "unit" | "lesson";
  id: string;
  displayOrder: number;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ courseId: string }> }) {
  try {
    const { courseId } = await params;
    const supabaseAdmin = await createServiceClient();
    const body = await request.json();
    const { items } = body as { items: ReorderItem[] };

    if (!items || !Array.isArray(items)) {
      return NextResponse.json({ error: "Items array is required" }, { status: 400 });
    }

    const unitUpdates = items
      .filter(item => item.type === "unit")
      .map(item =>
        supabaseAdmin
          .from("course_units")
          .update({ display_order: item.displayOrder })
          .eq("id", item.id)
          .eq("course_id", courseId)
      );

    const lessonUpdates = items
      .filter(item => item.type === "lesson")
      .map(item =>
        supabaseAdmin
          .from("lessons")
          .update({ display_order: item.displayOrder })
          .eq("id", item.id)
          .eq("course_id", courseId)
      );

    await Promise.all([...unitUpdates, ...lessonUpdates]);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Reorder units/lessons error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
