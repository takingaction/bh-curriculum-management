import { createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const supabaseAdmin = await createServiceClient();

    const { data: profiles, error } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ profiles });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabaseAdmin = await createServiceClient();
    const body = await request.json();

    const {
      first_name,
      last_name,
      email,
      california,
      district_name,
      primary_discipline,
      enrollment_status,
      enrollments,
      role
    } = body;

    if (!first_name || !last_name || !email) {
      return NextResponse.json(
        { error: "First name, last name, and email are required" },
        { status: 400 }
      );
    }

    const validDisciplines = ['N/A', 'MUSIC', 'THEATRE', 'DANCE'];
    if (primary_discipline && !validDisciplines.includes(primary_discipline)) {
      return NextResponse.json(
        { error: "Invalid primary discipline" },
        { status: 400 }
      );
    }

    const validStatuses = ['active', 'trial', 'inactive'];
    if (enrollment_status && !validStatuses.includes(enrollment_status)) {
      return NextResponse.json(
        { error: "Invalid enrollment status" },
        { status: 400 }
      );
    }

    const { data: existingUser } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("email", email.toLowerCase())
      .single();

    if (existingUser) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 }
      );
    }

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email.toLowerCase(),
      email_confirm: true,
      user_metadata: {
        first_name,
        last_name,
      }
    });

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 500 });
    }

    if (!authData?.user) {
      return NextResponse.json(
        { error: "Failed to create user" },
        { status: 500 }
      );
    }

    const trialStartsAt = enrollment_status === 'trial' ? new Date().toISOString() : null;
    const trialEndsAt = enrollment_status === 'trial' ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString() : null;

    // Profile already exists due to handle_new_user trigger, so UPDATE instead of INSERT
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({
        email: email.toLowerCase(),
        first_name,
        last_name,
        role: role || "teacher",
        california: california !== false,
        district_name: district_name || null,
        primary_discipline: primary_discipline || 'N/A',
        enrollment_status: enrollment_status || "trial",
        enrollments: enrollments || ["ALL"],
        trial_starts_at: trialStartsAt,
        trial_ends_at: trialEndsAt,
      })
      .eq("id", authData.user.id)
      .select()
      .single();

    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      return NextResponse.json({ error: profileError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: "Teacher created successfully",
      profile
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
