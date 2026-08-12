import { createClient, createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { MODIFICATION_REASONS, type ModificationReason } from "@/lib/version-utils";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ lessonId: string; versionId: string }> }
) {
  try {
    const supabase = await createClient();
    const { lessonId, versionId } = await params;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: version, error } = await supabase
      .from("lesson_versions")
      .select("*")
      .eq("id", versionId)
      .eq("lesson_id", lessonId)
      .is("deleted_at", null)
      .single();

    if (error || !version) {
      return NextResponse.json({ error: "Version not found" }, { status: 404 });
    }

    return NextResponse.json({ version });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ lessonId: string; versionId: string }> }
) {
  try {
    const supabase = await createClient();
    const { lessonId, versionId } = await params;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = user.id;
    const body = await request.json();

    const { data: existingVersion, error: fetchError } = await supabase
      .from("lesson_versions")
      .select("*")
      .eq("id", versionId)
      .eq("lesson_id", lessonId)
      .is("deleted_at", null)
      .single();

    if (fetchError || !existingVersion) {
      return NextResponse.json({ error: "Version not found" }, { status: 404 });
    }

    if (existingVersion.created_by !== userId) {
      return NextResponse.json({ error: "You can only edit your own versions" }, { status: 403 });
    }

    const updates: Record<string, unknown> = {};

    if (body.version_name !== undefined) {
      updates.version_name = body.version_name;
    }

    if (body.is_approved !== undefined) {
      updates.is_approved = body.is_approved;
    }

    if (body.content !== undefined) {
      updates.content = body.content;
    }

    if (body.deleted_at !== undefined) {
      updates.deleted_at = body.deleted_at;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No updates provided" }, { status: 400 });
    }

    const { data: updatedVersion, error: updateError } = await supabase
      .from("lesson_versions")
      .update(updates)
      .eq("id", versionId)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating version:", updateError);
      return NextResponse.json({ error: "Failed to update version" }, { status: 500 });
    }

    return NextResponse.json({ version: updatedVersion });
  } catch (error: any) {
    console.error("Version update error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ lessonId: string; versionId: string }> }
) {
  try {
    const supabase = await createClient();
    const { lessonId, versionId } = await params;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = user.id;

    const { data: existingVersion, error: fetchError } = await supabase
      .from("lesson_versions")
      .select("*")
      .eq("id", versionId)
      .eq("lesson_id", lessonId)
      .is("deleted_at", null)
      .single();

    if (fetchError || !existingVersion) {
      return NextResponse.json({ error: "Version not found" }, { status: 404 });
    }

    if (existingVersion.created_by !== userId) {
      return NextResponse.json({ error: "You can only delete your own versions" }, { status: 403 });
    }

    const { error: deleteError } = await supabase
      .from("lesson_versions")
      .delete()
      .eq("id", versionId);

    if (deleteError) {
      console.error("Error deleting version:", deleteError);
      return NextResponse.json({ error: "Failed to delete version" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Version delete error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
