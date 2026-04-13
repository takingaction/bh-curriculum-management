import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function TeacherDashboard() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user?.id)
    .single();

  const { data: assignments } = await supabase
    .from("teacher_assignments")
    .select("*, courses(*)")
    .eq("teacher_id", user?.id);

  const { data: adaptedLessons } = await supabase
    .from("adapted_lessons")
    .select("id")
    .eq("teacher_id", user?.id);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h2 className="text-2xl font-bold">Welcome, {profile?.full_name || profile?.email}</h2>
        <p className="text-gray-600">Your curriculum and teaching resources</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle>{assignments?.length || 0}</CardTitle>
            <CardDescription>Assigned Courses</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>
              {assignments?.reduce((acc, a) => acc + (a.courses?.total_lessons || 0), 0) || 0}
            </CardTitle>
            <CardDescription>Total Lessons</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{adaptedLessons?.length || 0}</CardTitle>
            <CardDescription>AI Adaptations</CardDescription>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your Courses</CardTitle>
          <CardDescription>Curriculum assigned to you</CardDescription>
        </CardHeader>
        <CardContent>
          {assignments && assignments.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {assignments.map((assignment) => (
                <Link
                  key={assignment.id}
                  href={`/teacher/courses/${assignment.course_id}`}
                >
                  <div className="p-4 border rounded-lg hover:bg-gray-50 transition">
                    <h3 className="font-semibold">{assignment.courses?.title}</h3>
                    <p className="text-sm text-gray-500">
                      {assignment.courses?.discipline} · Grade {assignment.courses?.grade}
                    </p>
                    <p className="text-sm text-gray-500 mt-2">
                      {assignment.courses?.total_lessons} lessons
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-gray-500">
              No courses assigned yet. Contact an administrator.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
