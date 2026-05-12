import { createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").trim();
}

export async function POST() {
  try {
    const supabaseAdmin = await createServiceClient();

    const { data: lessons, error: fetchError } = await supabaseAdmin
      .from("lessons")
      .select("id, title");

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    const updates: { id: string; title: string }[] = [];

    for (const lesson of lessons || []) {
      const cleanTitle = stripHtml(lesson.title || "");
      if (cleanTitle !== lesson.title) {
        updates.push({ id: lesson.id, title: cleanTitle });
      }
    }

    if (updates.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No titles needed cleaning",
        cleaned: 0,
      });
    }

    const { error: updateError } = await supabaseAdmin
      .from("lessons")
      .upsert(updates, { onConflict: "id" });

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `Cleaned ${updates.length} lesson titles`,
      cleaned: updates.length,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}