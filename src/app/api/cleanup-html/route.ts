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
          let transformed = original;

          // 1. Remove anchor-standard class from h3
          transformed = transformed
            .replace(/<h3 class="anchor-standard">/gi, '<h3>')
            .replace(/<h3([^>]*)class="anchor-standard"([^>]*)>/gi, '<h3$1$2>');

          // 2. Fix p>strong with h3 closing (malformed)
          transformed = transformed.replace(
            /<p[^>]*><strong>([^<]*)<\/h3>/gi,
            '<p><strong>$1</strong></p>'
          );

          // 3. Fix h3 with stray </strong> inside (malformed)
          transformed = transformed.replace(
            /<h3[^>]*>([^<]*)<\/strong>([^<]*)<\/h3>/gi,
            '<p><strong>$1$2</strong></p>'
          );

          // 3. Fix h3 > strong > PK.MU:/PK:/MU: (extract from nested strong)
          transformed = transformed.replace(
            /<h3[^>]*><strong>((?:PK\.MU|PK|MU)[^<]*)<\/strong><\/h3>/gi,
            '<p><strong>$1</strong></p>'
          );

          // 4. Convert h3 with PK.MU:/PK:/MU: to p>strong
          transformed = transformed.replace(
            /<h3[^>]*>((?:PK\.MU|PK|MU)[^<]*)<\/h3>/gi,
            '<p><strong>$1</strong></p>'
          );

          // 5. Clean orphaned </strong></p>
          transformed = transformed.replace(/<\/strong><\/p>/g, '</p>');

          // 6. Fix tables: remove colgroup, replace min-width with proper width/alignment
          transformed = transformed.replace(/<colgroup>.*?<\/colgroup>/gi, '');
          transformed = transformed.replace(
            /<table([^>]*)style="min-width:\s*\d+px"/gi,
            '<table$1style="width: 75%; margin-left: auto; margin-right: auto;"'
          );
          transformed = transformed.replace(
            /<table([^>]*)>/gi,
            (match: string, attrs: string) => {
              if (attrs.includes('style="')) return match;
              return `<table${attrs}style="width: 75%; margin-left: auto; margin-right: auto;">`;
            }
          );

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
      message: `Cleaned HTML in ${updates.length} lessons`,
      cleaned: updates.length,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
