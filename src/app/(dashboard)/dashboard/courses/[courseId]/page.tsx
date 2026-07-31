import { createClient, createServiceClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

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

  console.log("DEBUG: courseId=", courseId, "course=", course, "userId=", user!.id);

  if (!course) {
    console.log("DEBUG: course is null, calling notFound()");
    notFound();
    return;
  }

  const { data: lessons } = await supabaseAdmin
    .from("lessons")
    .select("*")
    .eq("course_id", courseId)
    .order("lesson_number");

  const { data: adaptedLessons } = await supabaseAdmin
    .from("adapted_lessons")
    .select("id, original_lesson_id")
    .eq("teacher_id", user!.id)
    .in(
      "original_lesson_id",
      lessons?.map((l) => l.id) || []
    );

  const adaptedMap = new Set(adaptedLessons?.map((a) => a.original_lesson_id) || []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h2 className="text-2xl font-bold">{course?.title}</h2>
        <p className="text-gray-600">
          {course?.discipline} · Grade {course?.grade}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lessons ({lessons?.length || 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {lessons && lessons.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lessons.map((lesson) => (
                  <TableRow key={lesson.id}>
                    <TableCell>{lesson.lesson_number}</TableCell>
                    <TableCell>{lesson.title}</TableCell>
                    <TableCell>{lesson.total_time || "-"}</TableCell>
                    <TableCell>
                      {adaptedMap.has(lesson.id) ? (
                        <Badge>Adapted</Badge>
                      ) : (
                        <Badge variant="secondary">Original</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Link href={`/lessons/${lesson.id}`}>
                        <Button variant="outline" size="sm">View</Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-gray-500">No lessons in this course</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
