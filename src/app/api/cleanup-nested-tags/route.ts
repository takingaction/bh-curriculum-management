import { createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

function flattenNestedTags(html: string): string {
  return html
    .replace(/<strong>\s*<strong>/g, "<strong>")
    .replace(/<\/strong>\s*<\/strong>/g, "</strong>")
    .replace(/<em>\s*<em>/g, "<em>")
    .replace(/<\/em>\s*<\/em>/g, "</em>")
    .replace(/>\s+</g, "><")
    .replace(/\s{2,}/g, " ");
}

export async function POST() {
  try {
    const supabaseAdmin = await createServiceClient();

    const contentFields = [
      "lesson_outline",
      "learning_objectives",
      "vocabulary",
      "materials",
      "vapa_text_block",
      "ncas_text_block",
      "welcome_opening",
      "actual_class_expectations",
      "lesson_hook",
      "warm_up",
      "main_activity",
      "instrument_expectations",
      "reflection",
      "closing_ceremony",
      "assessment",
    ];

    const { data: lessons, error: fetchError } = await supabaseAdmin
      .from("lessons")
      .select("id, " + contentFields.join(", ")) as { data: any[], error: any };

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    const updates: any[] = [];

    for (const lesson of (lessons || []) as any[]) {
      let needsUpdate = false;
      const updateData: any = { id: lesson.id };

      for (const field of contentFields) {
        if (lesson[field]) {
          const original = lesson[field];
          const flattened = flattenNestedTags(original);

          if (flattened !== original) {
            updateData[field] = flattened;
            needsUpdate = true;
          }
        }
      }

      if (needsUpdate) {
        updates.push(updateData);
      }
    }

    if (updates.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No nested tags found",
        cleaned: 0,
      });
    }

    const { error: updateError } = await supabaseAdmin
      .from("lessons")
      .upsert(updates, { onConflict: "id" }) as { error: any };

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `Cleaned nested tags in ${updates.length} lessons`,
      cleaned: updates.length,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}