import { createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const supabaseAdmin = await createServiceClient();
    const body = await request.json();

    const { user_id, action, resource_id } = body;

    if (!user_id || !action) {
      return NextResponse.json(
        { error: "user_id and action are required" },
        { status: 400 }
      );
    }

    const validActions = ['login', 'view_lesson', 'view_course'];
    if (!validActions.includes(action)) {
      return NextResponse.json(
        { error: "Invalid action" },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("user_activity_log")
      .insert({
        user_id,
        action,
        resource_id: resource_id || null,
      })
      .select("id")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, id: data.id });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
