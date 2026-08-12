import { createClient } from "@/lib/supabase/server";
import DashboardClient from "@/components/dashboard-client";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return <div>Loading...</div>;
  }

  const userId = user.id;

  let { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  const isInactive = profile?.enrollment_status === "inactive" ||
    (profile?.enrollment_status === "trial" && profile?.trial_ends_at && new Date(profile.trial_ends_at) < new Date());

  if (isInactive && profile?.enrollment_status === "trial") {
    await supabase
      .from("profiles")
      .update({ enrollment_status: "inactive" })
      .eq("id", userId);
    profile = { ...profile, enrollment_status: "inactive" };
  }

  const isTrial = profile?.enrollment_status === "trial";
  const trialEndsAt = profile?.trial_ends_at || null;

  const isAdmin = profile?.role === "admin";
  const enrollments = profile?.enrollments || ["ALL"];

  let courses: any[] = [];
  let lessonCounts: Record<string, number> = {};

  const { data: allCourses } = await supabase
    .from("courses")
    .select("*")
    .order("discipline", { ascending: true })
    .order("grade", { ascending: true });

  const gradeOrder = ["PK", "K", "1", "2", "3", "4", "5", "6"];
  const sortedCourses = (courses: any[]) => {
    return [...courses].sort((a, b) => {
      const aIndex = gradeOrder.indexOf(a.grade);
      const bIndex = gradeOrder.indexOf(b.grade);
      return aIndex - bIndex;
    });
  };

  if (enrollments.includes("ALL")) {
    courses = sortedCourses(allCourses || []);
  } else {
    courses = sortedCourses((allCourses || []).filter((course: any) => {
      const courseKey = `${course.discipline.toUpperCase()}_GRADE_${course.grade.toUpperCase()}`;
      const disciplineOnly = course.discipline.toUpperCase();
      return enrollments.includes(courseKey) || enrollments.includes(disciplineOnly);
    }));
  }

  const courseIds = courses.map((c: any) => c.id);
  if (courseIds.length > 0) {
    const { data: lessons } = await supabase
      .from("lessons")
      .select("course_id")
      .in("course_id", courseIds);
    lessons?.forEach((lesson) => {
      lessonCounts[lesson.course_id] = (lessonCounts[lesson.course_id] || 0) + 1;
    });
  }

  const { data: adaptedLessons } = await supabase
    .from("adapted_lessons")
    .select("id")
    .eq("teacher_id", userId);

  return (
    <DashboardClient
      profile={profile}
      isAdmin={isAdmin}
      courses={courses}
      lessonCounts={lessonCounts}
      adaptedCount={adaptedLessons?.length || 0}
      isInactive={isInactive}
      isTrial={isTrial}
      trialEndsAt={trialEndsAt}
    />
  );
}
