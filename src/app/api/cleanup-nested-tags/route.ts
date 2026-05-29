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

function transformContent(html: string): string {
  let result = html;

  // 1. Flatten nested strong/em tags
  result = flattenNestedTags(result);

  // 2. Convert VAPA/NCAS anchor standards to h3 with anchor-standard class
  // Matches headings containing "Anchor Standard" (case insensitive)
  result = result.replace(
    /<p(\s+[^>]*)?><strong>([^<]*Anchor Standard[^<]*)<\/strong><\/p>/gi,
    '<h3$1 class="anchor-standard">$2</h3>'
  );

  // 3. Convert all remaining bold headings to h3 (preserving style attributes)
  result = result.replace(
    /<p(\s+[^>]*)?><strong>(?!.* — )(.{1,60}?)<\/strong><\/p>/g,
    '<h3$1>$2</h3>'
  );

  return result;
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
      if (!lesson.id) continue;

      let needsUpdate = false;
      const updateData: any = { id: lesson.id };

      for (const field of contentFields) {
        if (lesson[field]) {
          const original = lesson[field];
          const transformed = transformContent(original);

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
      message: `Transformed h3 and anchor standards in ${updates.length} lessons`,
      cleaned: updates.length,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}