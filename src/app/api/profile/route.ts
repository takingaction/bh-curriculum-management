import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError) {
      console.error("Auth error:", authError);
    }

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, email, full_name, role")
      .eq("id", user.id)
      .single();

    console.log("Profile query:", { profile, error: profileError });

    return NextResponse.json({
      profile: profile ? { ...profile, email: user.email } : null,
      error: profileError?.message || null
    });
  } catch (error: any) {
    console.error("Profile API error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}