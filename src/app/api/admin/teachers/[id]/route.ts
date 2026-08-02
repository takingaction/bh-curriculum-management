import { createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabaseAdmin = await createServiceClient();
    const { id } = await params;

    const { data: profile, error } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    return NextResponse.json({ profile });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabaseAdmin = await createServiceClient();
    const { id } = await params;
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
      role,
      password
    } = body;

    const validDisciplines = ['N/A', 'MUSIC', 'THEATRE', 'DANCE'];
    if (primary_discipline && !validDisciplines.includes(primary_discipline)) {
      return NextResponse.json({ error: "Invalid primary discipline" }, { status: 400 });
    }

    const validStatuses = ['active', 'trial', 'inactive'];
    if (enrollment_status && !validStatuses.includes(enrollment_status)) {
      return NextResponse.json({ error: "Invalid enrollment status" }, { status: 400 });
    }

    const updateData: any = {};

    if (first_name !== undefined) updateData.first_name = first_name;
    if (last_name !== undefined) updateData.last_name = last_name;
    if (california !== undefined) updateData.california = california;
    if (district_name !== undefined) updateData.district_name = district_name;
    if (primary_discipline !== undefined) updateData.primary_discipline = primary_discipline;
    if (enrollment_status !== undefined) {
      updateData.enrollment_status = enrollment_status;
      if (enrollment_status === 'trial') {
        updateData.trial_starts_at = new Date().toISOString();
        updateData.trial_ends_at = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
      } else {
        updateData.trial_starts_at = null;
        updateData.trial_ends_at = null;
      }
    }
    if (enrollments !== undefined) updateData.enrollments = enrollments;
    if (role !== undefined) updateData.role = role;

    if (email !== undefined) {
      const { data: existing } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("email", email.toLowerCase())
        .neq("id", id)
        .single();

      if (existing) {
        return NextResponse.json({ error: "Email already in use by another user" }, { status: 409 });
      }
      updateData.email = email.toLowerCase();
    }

    if (password) {
      const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(id, {
        password,
        email: updateData.email || undefined,
      });

      if (authError) {
        return NextResponse.json({ error: authError.message }, { status: 500 });
      }
    }

    const { data: profile, error } = await supabaseAdmin
      .from("profiles")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, profile });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabaseAdmin = await createServiceClient();
    const { id } = await params;

    const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(id);

    if (deleteAuthError) {
      return NextResponse.json({ error: deleteAuthError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "User deleted successfully" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
