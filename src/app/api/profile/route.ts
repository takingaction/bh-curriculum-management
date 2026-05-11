import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ profile: null }, { status: 401 });
    }

    let { data: profile, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (error && error.code === "PGRST116") {
      // Profile doesn't exist, create it
      const { data: newProfile, createError } = await supabase
        .from("profiles")
        .insert({
          id: user.id,
          email: user.email,
          role: "teacher",
          full_name: null,
        })
        .select()
        .single();

      if (createError) {
        console.error("Error creating profile:", createError);
      }
      profile = newProfile;
    } else if (error) {
      console.error("Profile fetch error:", error);
    }

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
