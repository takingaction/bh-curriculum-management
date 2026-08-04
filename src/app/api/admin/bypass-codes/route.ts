import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { generateBypassCode, generateUniversalToken, getStartOfDayUTC, getExpiryDate } from "@/lib/bypass-utils";

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

    const [codesResult, universalResult] = await Promise.all([
      supabaseAdmin
        .from("bypass_codes")
        .select("*")
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("universal_tokens")
        .select("*")
        .single(),
    ]);

    if (codesResult.error) {
      return NextResponse.json({ error: codesResult.error.message }, { status: 500 });
    }

    return NextResponse.json({
      codes: codesResult.data || [],
      universalToken: universalResult.data || null,
    });

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
    const { email, universal } = body;

    if (universal === true) {
      await supabaseAdmin
        .from("universal_tokens")
        .delete();

      const token = generateUniversalToken();
      const { error: insertError } = await supabaseAdmin
        .from("universal_tokens")
        .insert({
          token,
          created_by: user.id,
        });

      if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }

      return NextResponse.json({ token });
    }

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

export async function DELETE(_request: Request) {
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

    const { error: deleteError } = await supabaseAdmin
      .from("universal_tokens")
      .delete();

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    const message = error instanceof Error ? error.message : "An unexpected error occurred";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
