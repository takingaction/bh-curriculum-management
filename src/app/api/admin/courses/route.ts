import { createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const supabase = await createServiceClient();

    const { data: courses, error } = await supabase
      .from("courses")
      .select("id, title, discipline, grade")
      .order("discipline", { ascending: true })
      .order("grade", { ascending: true })
      .order("title", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ courses });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
