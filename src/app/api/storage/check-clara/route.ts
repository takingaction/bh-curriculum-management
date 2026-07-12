import { createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const supabaseAdmin = await createServiceClient();

    // Check for CLARA_Swash_Teal_ in all lesson columns
    const { data, error } = await supabaseAdmin
      .from("lessons")
      .select("id, course_id")
      .or(`lesson_outline.ilike.%CLARA_Swash_Teal_%,
          learning_objectives.ilike.%CLARA_Swash_Teal_%,
          vocabulary.ilike.%CLARA_Swash_Teal_%,
          materials.ilike.%CLARA_Swash_Teal_%,
          vapa_text_block.ilike.%CLARA_Swash_Teal_%,
          ncas_text_block.ilike.%CLARA_Swash_Teal_%,
          welcome_opening.ilike.%CLARA_Swash_Teal_%,
          actual_class_expectations.ilike.%CLARA_Swash_Teal_%,
          lesson_hook.ilike.%CLARA_Swash_Teal_%,
          warm_up.ilike.%CLARA_Swash_Teal_%,
          main_activity.ilike.%CLARA_Swash_Teal_%,
          instrument_expectations.ilike.%CLARA_Swash_Teal_%,
          reflection.ilike.%CLARA_Swash_Teal_%,
          closing_ceremony.ilike.%CLARA_Swash_Teal_%,
          assessment.ilike.%CLARA_Swash_Teal_%`);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      count: data?.length || 0,
      lessonIds: data || []
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
