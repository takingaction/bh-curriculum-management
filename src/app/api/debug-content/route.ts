import { createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const supabaseAdmin = await createServiceClient();

    const { data: lesson, error } = await supabaseAdmin
      .from("lessons")
      .select("id, title, vapa_text_block, ncas_text_block")
      .limit(1)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      id: lesson.id,
      title: lesson.title,
      vapa_text_block: lesson.vapa_text_block?.substring(0, 500),
      ncas_text_block: lesson.ncas_text_block?.substring(0, 500),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
