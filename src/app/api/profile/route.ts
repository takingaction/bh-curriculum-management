import { createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const supabase = await createServiceClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ role: null }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    return NextResponse.json({ role: profile?.role || "teacher" });
  } catch (error: any) {
    return NextResponse.json({ role: "teacher" }, { status: 500 });
  }
}
