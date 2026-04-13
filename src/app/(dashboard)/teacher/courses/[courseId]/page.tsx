import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: assignment } = await supabase
    .from("teacher_assignments")
    .select("*, courses(*)")
    .eq("teacher_id", user?.id)
    .eq("course_id", courseId)
    .single();

  if (!assignment) {
    notFound();
  }

  const { data: lessons } = await supabase
    .from("lessons")
    .select("*")
    .eq("course_id", courseId)
    .order("lesson_number");

  const { data: adaptedLessons } = await supabase
    .from("adapted_lessons")
    .select("id, original_lesson_id")
    .eq("teacher_id", user?.id)
    .in(
      "original_lesson_id",
      lessons?.map((l) => l.id) || []
    );

  const adaptedMap = new Set(adaptedLessons?.map((a) => a.original_lesson_id) || []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h2 className="text-2xl font-bold">{assignment.courses?.title}</h2>
        <p className="text-gray-600">
          {assignment.courses?.discipline} · Grade {assignment.courses?.grade}
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
                      <Link href={`/teacher/courses/${courseId}/lessons/${lesson.id}`}>
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
