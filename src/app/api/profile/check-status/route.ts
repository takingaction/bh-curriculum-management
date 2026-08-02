import { createClient, createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const supabaseAdmin = await createServiceClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const isExpired = profile.enrollment_status === "trial" &&
      profile.trial_ends_at &&
      new Date(profile.trial_ends_at) < new Date();

    if (isExpired) {
      await supabaseAdmin
        .from("profiles")
        .update({ enrollment_status: "inactive" })
        .eq("id", user.id);

      return NextResponse.json({
        profile: {
          ...profile,
          enrollment_status: "inactive"
        },
        was_expired: true
      });
    }

    return NextResponse.json({
      profile,
      was_expired: false
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
