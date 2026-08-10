import { createClient, createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { TEXT_FIELDS_LIST } from "@/lib/html-utils";
import {
  validateContentLengths,
  buildVersionContent,
  MODIFICATION_REASONS,
  type ModificationReason,
  type VersionContent,
} from "@/lib/version-utils";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ lessonId: string }> }
) {
  try {
    const supabase = await createClient();
    const { lessonId } = await params;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: versions, error } = await supabase
      .from("lesson_versions")
      .select("*")
      .eq("lesson_id", lessonId)
      .is("deleted_at", null)
      .order("version_number", { ascending: true });

    if (error) {
      console.error("Error fetching versions:", error);
      return NextResponse.json({ error: "Failed to fetch versions" }, { status: 500 });
    }

    return NextResponse.json({ versions: versions || [] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ lessonId: string }> }
) {
  try {
    const supabase = await createClient();
    const { lessonId } = await params;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const body = await request.json();
    const { version_name, content, modification_reason } = body as {
      version_name?: string;
      content: VersionContent;
      modification_reason?: string;
    };

    if (!content || typeof content !== "object") {
      return NextResponse.json({ error: "Content is required" }, { status: 400 });
    }

    const supabaseAdmin = await createServiceClient();

    // IMPORTANT: Query ALL versions including soft-deleted ones because the unique constraint
    // is on (lesson_id, version_number) - soft-deleted versions still occupy their version numbers
    const { data: existingVersions, error: countError } = await supabaseAdmin
      .from("lesson_versions")
      .select("version_number")
      .eq("lesson_id", lessonId)
      .order("version_number", { ascending: false })
      .limit(1);

    console.log("[VERSIONS API] Existing versions (including deleted) for lesson", lessonId, ":", existingVersions, "error:", countError);

    if (countError) {
      console.error("Error counting versions:", countError);
      return NextResponse.json({ error: "Failed to check version limit" }, { status: 500 });
    }

    // Calculate next version number from max existing (including soft-deleted)
    let nextVersionNumber = 1;
    if (existingVersions && existingVersions.length > 0 && existingVersions[0]?.version_number) {
      nextVersionNumber = existingVersions[0].version_number + 1;
    }

    console.log("[VERSIONS API] Next version number will be:", nextVersionNumber);

    const { data: lesson, error: lessonError } = await supabaseAdmin
      .from("lessons")
      .select("id, lesson_number, course_id")
      .eq("id", lessonId)
      .single();

    if (lessonError || !lesson) {
      return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
    }

    const { data: course, error: courseError } = await supabaseAdmin
      .from("courses")
      .select("discipline, grade")
      .eq("id", lesson.course_id)
      .single();

    if (courseError || !course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    console.log("[VERSIONS API] Creating version with content keys:", Object.keys(content));

    const originalContent: VersionContent = {};
    for (const field of TEXT_FIELDS_LIST) {
      const fieldData = content[field] as { html?: string } | undefined;
      const html = fieldData?.html || "";
      originalContent[field] = {
        html,
        original_length: html.replace(/<[^>]*>/g, "").trim().length,
      };
      if (html) {
        console.log(`[VERSIONS API] Field ${field} has ${html.length} chars`);
      }
    }

    const { data: version, error: insertError } = await supabaseAdmin
      .from("lesson_versions")
      .insert({
        lesson_id: lessonId,
        version_number: nextVersionNumber,
        version_name: version_name || `Version ${nextVersionNumber}`,
        content: originalContent,
        modification_reason: modification_reason || null,
        created_by: userId,
      })
      .select()
      .single();

    if (insertError) {
      if (insertError.message.includes("Maximum of 3 active versions")) {
        return NextResponse.json(
          { error: "Maximum of 3 active versions allowed per lesson. Please delete one to create a new version." },
          { status: 400 }
        );
      }
      // Handle duplicate key error by re-fetching max version number and retrying
      if (insertError.code === '23505') {
        console.log("[VERSIONS API] Duplicate key error, re-fetching max version number...");
        const { data: allVersions } = await supabaseAdmin
          .from("lesson_versions")
          .select("version_number")
          .eq("lesson_id", lessonId)
          .order("version_number", { ascending: false })
          .limit(1);
        
        const retryVersionNumber = (allVersions?.[0]?.version_number || 0) + 1;
        console.log("[VERSIONS API] Retrying with version number:", retryVersionNumber);
        
        const { data: retryVersion, error: retryError } = await supabaseAdmin
          .from("lesson_versions")
          .insert({
            lesson_id: lessonId,
            version_number: retryVersionNumber,
            version_name: version_name || `Version ${retryVersionNumber}`,
            content: originalContent,
            modification_reason: modification_reason || null,
            created_by: userId,
          })
          .select()
          .single();
        
        if (retryError) {
          console.error("Error creating version on retry:", retryError);
          return NextResponse.json({ error: "Failed to create version" }, { status: 500 });
        }
        return NextResponse.json({ version: retryVersion }, { status: 201 });
      }
      console.error("Error creating version:", insertError);
      return NextResponse.json({ error: "Failed to create version" }, { status: 500 });
    }

    return NextResponse.json({ version }, { status: 201 });
  } catch (error: any) {
    console.error("Version creation error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
