import { createClient, createServiceClient } from "@/lib/supabase/server";
import DashboardClient from "@/components/dashboard-client";

export default async function DashboardPage() {
  const supabase = await createClient();
  const supabaseAdmin = await createServiceClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user?.id)
    .single();

  const isInactive = profile?.enrollment_status === "inactive" ||
    (profile?.enrollment_status === "trial" && profile?.trial_ends_at && new Date(profile.trial_ends_at) < new Date());

  if (isInactive && profile?.enrollment_status === "trial") {
    await supabaseAdmin
      .from("profiles")
      .update({ enrollment_status: "inactive" })
      .eq("id", user?.id);
    profile = { ...profile, enrollment_status: "inactive" };
  }

  const isAdmin = profile?.role === "admin";
  const enrollments = profile?.enrollments || ["ALL"];

  let courses: any[] = [];
  let lessonCounts: Record<string, number> = {};

  if (isAdmin) {
    const { data: allCourses } = await supabaseAdmin
      .from("courses")
      .select("*")
      .order("discipline", { ascending: true })
      .order("grade", { ascending: true });
    courses = allCourses || [];

    const { data: allLessons } = await supabaseAdmin
      .from("lessons")
      .select("course_id");
    allLessons?.forEach((lesson) => {
      lessonCounts[lesson.course_id] = (lessonCounts[lesson.course_id] || 0) + 1;
    });
  } else {
    const { data: assignments } = await supabaseAdmin
      .from("teacher_assignments")
      .select("*, courses(*)")
      .eq("teacher_id", user?.id);
    
    let assignedCourses = assignments?.map((a: any) => a.courses).filter(Boolean) || [];

    if (!enrollments.includes("ALL")) {
      assignedCourses = assignedCourses.filter((course: any) => {
        const disciplineGrade = `${course.discipline.toUpperCase()}_GRADE_${course.grade.toUpperCase()}`;
        const disciplineOnly = course.discipline.toUpperCase();
        return enrollments.includes(disciplineGrade) || enrollments.includes(disciplineOnly);
      });
    }

    courses = assignedCourses;

    const courseIds = courses.map((c: any) => c.id);
    if (courseIds.length > 0) {
      const { data: lessons } = await supabaseAdmin
        .from("lessons")
        .select("course_id")
        .in("course_id", courseIds);
      lessons?.forEach((lesson) => {
        lessonCounts[lesson.course_id] = (lessonCounts[lesson.course_id] || 0) + 1;
      });
    }
  }

  const { data: adaptedLessons } = await supabaseAdmin
    .from("adapted_lessons")
    .select("id")
    .eq("teacher_id", user?.id);

  return (
    <DashboardClient
      profile={profile}
      isAdmin={isAdmin}
      courses={courses}
      lessonCounts={lessonCounts}
      adaptedCount={adaptedLessons?.length || 0}
      isInactive={isInactive}
    />
  );
}
