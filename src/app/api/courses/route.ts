import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's enrollments for filtering
    const { data: profile } = await supabase
      .from("profiles")
      .select("enrollments")
      .eq("id", user.id)
      .single();

    // Fetch all courses (filtered by enrollment for non-admins)
    let query = supabase
      .from("courses")
      .select("id, title, discipline, grade")
      .order("discipline")
      .order("grade")
      .order("title");

    // Apply enrollment filtering for non-admin users
    if (profile?.enrollments && Array.isArray(profile.enrollments)) {
      const enrollments = profile.enrollments;

      if (!enrollments.includes("ALL")) {
        // Build filter based on enrollments
        const disciplineFilters: string[] = [];
        const specificCourseFilters: string[] = [];

        enrollments.forEach((enrollment: string) => {
          if (enrollment === "ALL") {
            // No filter needed
          } else if (enrollment.startsWith("MUSIC") || enrollment.startsWith("DANCE") || enrollment.startsWith("THEATRE")) {
            // It's a discipline filter like "MUSIC" or "DANCE"
            const discipline = enrollment.replace("_GRADE_", " ").split(" ")[0];
            if (!disciplineFilters.includes(discipline)) {
              disciplineFilters.push(discipline);
            }
          } else if (enrollment.includes("_GRADE_")) {
            // It's a specific course filter like "MUSIC_GRADE_3"
            specificCourseFilters.push(enrollment);
          }
        });

        // Apply filters if needed
        if (disciplineFilters.length > 0 || specificCourseFilters.length > 0) {
          // Filter by either discipline IN (...) OR the specific enrollment keys
          query = query.or(
            `discipline.in.(${disciplineFilters.join(",")}),id.in.(${specificCourseFilters.join(",")})`
          );
        }
      }
      // If enrollments includes "ALL", no filter is applied
    }

    const { data: courses, error } = await query;

    if (error) {
      console.error("Error fetching courses:", error);
      return NextResponse.json({ error: "Failed to fetch courses" }, { status: 500 });
    }

    return NextResponse.json({ courses: courses || [] });

  } catch (error: any) {
    console.error("Courses API error:", error);
    return NextResponse.json({ error: error.message || "Failed" }, { status: 500 });
  }
}
