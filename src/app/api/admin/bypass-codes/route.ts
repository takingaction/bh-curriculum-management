import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { generateBypassCode, getStartOfDayUTC, getExpiryDate } from "@/lib/bypass-utils";

export async function GET() {
  try {
    const supabase = await createClient();
    const supabaseAdmin = await createServiceClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError || profile?.role !== "admin") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const { data: codes, error } = await supabaseAdmin
      .from("bypass_codes")
      .select(`
        *,
        creator:profiles!created_by(email, full_name)
      `)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ codes: codes || [] });

  } catch (error) {
    const message = error instanceof Error ? error.message : "An unexpected error occurred";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const supabaseAdmin = await createServiceClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError || profile?.role !== "admin") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
    }

    const startOfDay = getStartOfDayUTC().toISOString();
    const { count: todayCount, error: countError } = await supabaseAdmin
      .from("bypass_codes")
      .select("*", { count: "exact", head: true })
      .eq("created_by", user.id)
      .gte("created_at", startOfDay);

    if (countError) {
      return NextResponse.json({ error: "Failed to check rate limit" }, { status: 500 });
    }

    if ((todayCount || 0) >= 100) {
      return NextResponse.json(
        { error: "Daily limit reached (100 codes per day). Please try again tomorrow." },
        { status: 429 }
      );
    }

    const { data: existingUser } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("email", email.toLowerCase())
      .single();

    if (!existingUser) {
      return NextResponse.json(
        { error: "No account found with this email address" },
        { status: 404 }
      );
    }

    const code = generateBypassCode();
    const expiresAt = getExpiryDate(48).toISOString();

    const { data: newCode, error: insertError } = await supabaseAdmin
      .from("bypass_codes")
      .insert({
        code,
        email: email.toLowerCase(),
        created_by: user.id,
        expires_at: expiresAt,
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({
      code: newCode.code,
      email: newCode.email,
      expiresAt: newCode.expires_at,
      createdAt: newCode.created_at,
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : "An unexpected error occurred";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
