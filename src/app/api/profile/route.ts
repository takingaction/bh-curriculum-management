import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    console.log("GET /api/profile - user:", user?.id, user?.email);

    if (!user) {
      return NextResponse.json({ profile: null }, { status: 401 });
    }

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    console.log("GET /api/profile - profile from db:", profile);
    console.log("GET /api/profile - profile full_name:", profile?.full_name);
    console.log("GET /api/profile - profile role:", profile?.role);

    return NextResponse.json({
      profile: {
        ...profile,
        email: user.email,
      }
    });
  } catch (error: any) {
    console.error("GET /api/profile - error:", error);
    return NextResponse.json({ profile: null }, { status: 500 });
  }
}
