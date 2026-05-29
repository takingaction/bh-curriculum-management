import { createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

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
      if (!lesson.id) continue;

      let needsUpdate = false;
      const updateData: any = { id: lesson.id };

      for (const field of contentFields) {
        if (lesson[field]) {
          const original = lesson[field];
          const transformed = original
            // Remove anchor-standard class from h3
            .replace(/<h3 class="anchor-standard">/gi, '<h3>')
            .replace(/<h3([^>]*)class="anchor-standard"([^>]*)>/gi, '<h3$1$2>')
            // Convert h3 starting with PK: or MU: back to p > strong
            .replace(/<h3((?:PK|MU)\:[^<]*)<\/h3>/gi, '<p><strong$1</strong></p>');

          if (transformed !== original) {
            updateData[field] = transformed;
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
        message: "No changes needed",
        cleaned: 0,
      });
    }

    for (const update of updates) {
      await supabaseAdmin
        .from("lessons")
        .update(update)
        .eq("id", update.id);
    }

    return NextResponse.json({
      success: true,
      message: `Removed anchor-standard class from h3 tags in ${updates.length} lessons`,
      cleaned: updates.length,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
