import { createServiceClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth-helpers";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CourseImageUpload } from "@/components/course-image-upload";
import { CoursePdfImageUpload } from "@/components/course-pdf-image-upload";
import { CoursePdfCard } from "@/components/course-pdf-card";
import { ManageImagesButton } from "@/components/manage-images-button";
import { DeleteCourseButton } from "@/components/delete-course-button";
import { CourseSpotifySection } from "@/components/course-spotify-section";
import { CourseAssetsPanel } from "@/components/course-assets-panel";
import { CourseLessonsEditor } from "@/components/course-lessons-editor";
import { InlineDeleteButton } from "@/components/inline-delete-button";

export default async function CourseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  
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
    .select("id, lesson_number, title, total_time, display_order")
    .eq("course_id", id)
    .order("display_order", { ascending: true });

  const { data: units } = await supabase
    .from("course_units")
    .select("*")
    .eq("course_id", id)
    .order("display_order", { ascending: true });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4 mb-8">
        <div className="flex flex-col sm:flex-row gap-4">
          <CourseImageUpload courseId={course.id} currentImageUrl={course.image_url} />
          <div className="flex flex-col gap-1">
            <h2 className="text-2xl font-bold">{course.title}</h2>
            <p className="text-gray-600">
              {course.discipline} · Grade {course.grade}
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <ManageImagesButton courseId={course.id} />
            <span className="hidden md:inline">
              <DeleteCourseButton courseId={course.id} courseTitle={course.title} />
            </span>
            <span className="md:hidden">
              <InlineDeleteButton courseId={course.id} courseTitle={course.title} />
            </span>
          </div>
          <CourseEditForm course={course} />
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

      <CoursePdfCard courseId={course.id} courseName={course.title} />

      <Card className="mb-8">
        <CardContent className="pt-6">
          <CourseAssetsPanel courseId={course.id} canEdit={true} />
        </CardContent>
      </Card>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Course Content</CardTitle>
        </CardHeader>
        <CardContent>
          <CourseLessonsEditor
            courseId={course.id}
            initialLessons={lessons || []}
            initialUnits={units || []}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function CourseEditForm({ course }: { course: { id: string; title: string; discipline: string; grade: string; summary?: string; materials?: string } }) {
  return (
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
            materials: formData.get("materials") || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", course.id);
        redirect(`/admin/courses/${course.id}`);
      }}
      className="flex flex-col gap-2"
    >
      <input type="hidden" name="id" value={course.id} />
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          name="title"
          defaultValue={course.title}
          className="border rounded px-2 py-1 flex-1"
          required
        />
        <input
          name="discipline"
          defaultValue={course.discipline}
          className="border rounded px-2 py-1 w-full sm:w-32"
          required
        />
        <input
          name="grade"
          defaultValue={course.grade}
          className="border rounded px-2 py-1 w-full sm:w-20"
          required
        />
      </div>
      <textarea
        name="summary"
        defaultValue={course.summary || ""}
        placeholder="Course summary..."
        className="border rounded px-2 py-1 min-h-[60px] w-full"
      />
      <textarea
        name="materials"
        defaultValue={course.materials || ""}
        placeholder="Materials (one per line)..."
        className="border rounded px-2 py-1 min-h-[80px] w-full"
      />
      <Button type="submit" size="sm" className="self-start">Save</Button>
    </form>
  );
}
