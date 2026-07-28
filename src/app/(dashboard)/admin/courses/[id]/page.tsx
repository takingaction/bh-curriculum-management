import { createServiceClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CourseImageUpload } from "@/components/course-image-upload";
import { CoursePdfImageUpload } from "@/components/course-pdf-image-upload";
import { ManageImagesButton } from "@/components/manage-images-button";
import { DeleteCourseButton } from "@/components/delete-course-button";
import { CourseSpotifySection } from "@/components/course-spotify-section";
import { CourseAssetsPanel } from "@/components/course-assets-panel";

export default async function CourseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServiceClient();

  const { data: course } = await supabase
    .from("courses")
    .select("*")
    .eq("id", id)
    .single();

  if (!course) {
    notFound();
  }

  const { data: lessons } = await supabase
    .from("lessons")
    .select("*")
    .eq("course_id", id)
    .order("lesson_number");

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-start mb-8">
        <div className="flex gap-6">
          <CourseImageUpload courseId={course.id} currentImageUrl={course.image_url} />
          <div>
            <h2 className="text-2xl font-bold">{course.title}</h2>
            <p className="text-gray-600">
              {course.discipline} · Grade {course.grade}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <ManageImagesButton courseId={course.id} />
          <CourseEditForm course={course} />
          <DeleteCourseButton courseId={course.id} courseTitle={course.title} />
        </div>
      </div>

      <CourseSpotifySection courseId={course.id} initialSpotifyCode={course.spotify_embed_code || ""} />

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>PDF Hero Image</CardTitle>
        </CardHeader>
        <CardContent>
          <CoursePdfImageUpload courseId={course.id} currentImageUrl={course.pdf_image_url} />
        </CardContent>
      </Card>

      <Card className="mb-8">
        <CardContent className="pt-6">
          <CourseAssetsPanel courseId={course.id} canEdit={true} />
        </CardContent>
      </Card>

      <Card className="mb-8">
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
                      <div className="flex gap-2">
                        <Link href={`/lessons/${lesson.id}`}>
                          <Button variant="outline" size="sm">View</Button>
                        </Link>
                        <Link href={`/admin/courses/${id}/lessons/${lesson.id}`}>
                          <Button variant="outline" size="sm">Edit</Button>
                        </Link>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-gray-500">No lessons yet</p>
          )}
          <div className="mt-4">
            <Link href={`/admin/courses/${id}/lessons/new`}>
              <Button>Add Lesson</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function CourseEditForm({ course }: { course: { id: string; title: string; discipline: string; grade: string; summary?: string } }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <form
          action={async (formData) => {
            "use server";
            const supabase = await createServiceClient();
            await supabase
              .from("courses")
              .update({
                title: formData.get("title"),
                discipline: formData.get("discipline"),
                grade: formData.get("grade"),
                summary: formData.get("summary") || null,
                updated_at: new Date().toISOString(),
              })
              .eq("id", course.id);
            redirect(`/admin/courses/${course.id}`);
          }}
          className="flex flex-col gap-2"
        >
          <input type="hidden" name="id" value={course.id} />
          <div className="flex gap-2">
            <input
              name="title"
              defaultValue={course.title}
              className="border rounded px-2 py-1"
              required
            />
            <input
              name="discipline"
              defaultValue={course.discipline}
              className="border rounded px-2 py-1"
              required
            />
            <input
              name="grade"
              defaultValue={course.grade}
              className="border rounded px-2 py-1 w-20"
              required
            />
          </div>
          <textarea
            name="summary"
            defaultValue={course.summary || ""}
            placeholder="Course summary..."
            className="border rounded px-2 py-1 min-h-[60px]"
          />
          <Button type="submit" size="sm">Save</Button>
        </form>
      </CardContent>
    </Card>
  );
}
