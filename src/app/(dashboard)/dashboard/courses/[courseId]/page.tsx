import { createClient, createServiceClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import CourseClient from "./course-client";

export default async function TeacherCoursePage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  const supabase = await createClient();
  const supabaseAdmin = await createServiceClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: course } = await supabaseAdmin
    .from("courses")
    .select("*")
    .eq("id", courseId)
    .single();

  if (!course) {
    notFound();
    return;
  }

  const { data: lessons } = await supabaseAdmin
    .from("lessons")
    .select("*")
    .eq("course_id", courseId)
    .order("lesson_number");

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <CourseClient
        courseId={courseId}
        courseName={course.title}
        discipline={course.discipline}
        grade={course.grade}
        imageUrl={course.image_url}
        summary={course.summary}
        lessons={lessons || []}
        userId={user.id}
      />
    </div>
  );
}
