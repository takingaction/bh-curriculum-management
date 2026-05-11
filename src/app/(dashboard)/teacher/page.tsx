import { createClient, createServiceClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function TeacherDashboard() {
  const supabase = await createClient();
  const supabaseAdmin = await createServiceClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user?.id)
    .single();

  const { data: assignments } = await supabaseAdmin
    .from("teacher_assignments")
    .select("*, courses(*)")
    .eq("teacher_id", user?.id);

  const { data: allLessons } = await supabaseAdmin
    .from("lessons")
    .select("course_id");

  const lessonCounts: Record<string, number> = {};
  allLessons?.forEach((lesson) => {
    lessonCounts[lesson.course_id] = (lessonCounts[lesson.course_id] || 0) + 1;
  });

  const { data: adaptedLessons } = await supabaseAdmin
    .from("adapted_lessons")
    .select("id")
    .eq("teacher_id", user?.id);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-[#2d2d2d]">Welcome, {profile?.full_name || profile?.email}</h2>
        <p className="text-[#666666]">Your curriculum and teaching resources</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="border-[#e5e5e0] shadow-sm">
          <CardHeader className="bg-[#f5f5f0] rounded-t-lg">
            <CardTitle className="text-4xl font-bold text-[#0d7377]">{assignments?.length || 0}</CardTitle>
            <CardDescription className="text-[#666666]">Assigned Courses</CardDescription>
          </CardHeader>
        </Card>
        <Card className="border-[#e5e5e0] shadow-sm">
          <CardHeader className="bg-[#f5f5f0] rounded-t-lg">
            <CardTitle className="text-4xl font-bold text-[#0d7377]">
              {allLessons?.length || 0}
            </CardTitle>
            <CardDescription className="text-[#666666]">Total Lessons</CardDescription>
          </CardHeader>
        </Card>
        <Card className="border-[#e5e5e0] shadow-sm">
          <CardHeader className="bg-[#f5f5f0] rounded-t-lg">
            <CardTitle className="text-4xl font-bold text-[#0d7377]">{adaptedLessons?.length || 0}</CardTitle>
            <CardDescription className="text-[#666666]">AI Adaptations</CardDescription>
          </CardHeader>
        </Card>
      </div>

      <Card className="border-[#e5e5e0] shadow-sm">
        <CardHeader className="border-b border-[#e5e5e0]">
          <CardTitle className="text-[#2d2d2d]">Your Courses</CardTitle>
          <CardDescription className="text-[#666666]">Curriculum assigned to you</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          {assignments && assignments.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {assignments.map((assignment) => (
                <Link
                  key={assignment.id}
                  href={`/teacher/courses/${assignment.course_id}`}
                >
                  <div className="p-5 border border-[#e5e5e0] rounded-xl hover:bg-[#f5f5f0] hover:border-[#0d7377] transition-all cursor-pointer">
                    <h3 className="font-semibold text-[#2d2d2d]">{assignment.courses?.title}</h3>
                    <p className="text-sm text-[#666666] mt-1">
                      {assignment.courses?.discipline} · Grade {assignment.courses?.grade}
                    </p>
                    <p className="text-sm text-[#0d7377] font-medium mt-2">
                      {lessonCounts[assignment.course_id] || 0} lessons →
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-[#666666]">
              No courses assigned yet. Contact an administrator.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
