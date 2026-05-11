import { createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST() {
  try {
    const supabase = await createServiceClient();
    const supabaseAdmin = await createServiceClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { data: courses } = await supabaseAdmin
      .from("courses")
      .select("id");

    if (!courses || courses.length === 0) {
      return NextResponse.json({ message: "No courses found", assigned: 0 });
    }

    const assignments = courses.map((course) => ({
      teacher_id: user.id,
      course_id: course.id,
    }));

    const { error } = await supabaseAdmin
      .from("teacher_assignments")
      .upsert(assignments, { ignoreDuplicates: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      assigned: courses.length,
      message: `Assigned ${courses.length} courses to your account`,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
