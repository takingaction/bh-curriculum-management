import { createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function DELETE(request: Request) {
  try {
    const supabaseAdmin = await createServiceClient();
    const body = await request.json();
    const { ids } = body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "IDs array is required" }, { status: 400 });
    }

    for (const id of ids) {
      const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(id);
      if (deleteError) {
        console.error(`Failed to delete auth user ${id}:`, deleteError);
      }
    }

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .delete()
      .in("id", ids);

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 });
    }

    return NextResponse.json({ deleted_count: ids.length });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "An unexpected error occurred";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const supabaseAdmin = await createServiceClient();
    const body = await request.json();
    const { updates } = body;

    if (!updates || !Array.isArray(updates) || updates.length === 0) {
      return NextResponse.json({ error: "Updates array is required" }, { status: 400 });
    }

    const validStatuses = ['active', 'trial', 'inactive'];
    let updatedCount = 0;

    for (const update of updates) {
      const { id, enrollment_status, enrollments } = update;

      if (!id) continue;

      const updateData: Record<string, string | null | string[]> = {};

      if (enrollment_status !== undefined) {
        if (!validStatuses.includes(enrollment_status)) {
          return NextResponse.json(
            { error: `Invalid enrollment status: ${enrollment_status}` },
            { status: 400 }
          );
        }
        updateData.enrollment_status = enrollment_status;

        if (enrollment_status === 'trial') {
          updateData.trial_starts_at = new Date().toISOString();
          updateData.trial_ends_at = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
        } else {
          updateData.trial_starts_at = null;
          updateData.trial_ends_at = null;
        }
      }

      if (enrollments !== undefined) {
        if (!Array.isArray(enrollments)) {
          return NextResponse.json(
            { error: "Enrollments must be an array" },
            { status: 400 }
          );
        }
        updateData.enrollments = enrollments;
      }

      if (Object.keys(updateData).length === 0) continue;

      const { error: updateError } = await supabaseAdmin
        .from("profiles")
        .update(updateData)
        .eq("id", id);

      if (updateError) {
        console.error(`Failed to update profile ${id}:`, updateError);
        continue;
      }

      updatedCount++;
    }

    return NextResponse.json({ updated_count: updatedCount });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "An unexpected error occurred";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
