import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Link from "next/link";

const lessonFields = [
  { key: "lesson_outline", label: "Lesson Outline" },
  { key: "learning_objectives", label: "Learning Objectives" },
  { key: "vocabulary", label: "Vocabulary" },
  { key: "materials", label: "Materials" },
  { key: "vapa_text_block", label: "VAPA Text Block" },
  { key: "ncas_text_block", label: "NCAS Text Block" },
  { key: "welcome_opening", label: "Welcome Opening" },
  { key: "actual_class_expectations", label: "Class Expectations" },
  { key: "lesson_hook", label: "Lesson Hook" },
  { key: "warm_up", label: "Warm Up" },
  { key: "main_activity", label: "Main Activity" },
  { key: "instrument_expectations", label: "Instrument Expectations" },
  { key: "reflection", label: "Reflection" },
  { key: "closing_ceremony", label: "Closing Ceremony" },
  { key: "assessment", label: "Assessment" },
];

export default async function TeacherLessonPage({
  params,
}: {
  params: Promise<{ courseId: string; lessonId: string }>;
}) {
  const { courseId, lessonId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: assignment } = await supabase
    .from("teacher_assignments")
    .select("id")
    .eq("teacher_id", user?.id)
    .eq("course_id", courseId)
    .single();

  if (!assignment) {
    notFound();
  }

  const { data: lesson } = await supabase
    .from("lessons")
    .select("*")
    .eq("id", lessonId)
    .single();

  if (!lesson) {
    notFound();
  }

  const { data: adaptedLesson } = await supabase
    .from("adapted_lessons")
    .select("*")
    .eq("teacher_id", user?.id)
    .eq("original_lesson_id", lessonId)
    .single();

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <Link
          href={`/teacher/courses/${courseId}`}
          className="text-sm text-blue-600 hover:underline mb-2 inline-block"
        >
          ← Back to Course
        </Link>
        <h2 className="text-2xl font-bold">
          Lesson {lesson.lesson_number}: {lesson.title}
        </h2>
        {lesson.total_time && (
          <p className="text-gray-600">Duration: {lesson.total_time}</p>
        )}
      </div>

      {adaptedLesson ? (
        <Card className="mb-6 border-green-200 bg-green-50">
          <CardHeader>
            <CardTitle className="text-green-700">AI-Adapted Version</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-green-600">
              You've adapted this lesson. The content below shows your adapted version.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="mb-6 border-blue-200">
          <CardHeader>
            <CardTitle>Want to personalize this lesson?</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 mb-4">
              Use AI to adapt this lesson for your specific teaching style and students.
            </p>
            <AdaptLessonButton lessonId={lessonId} />
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="lesson_outline">
        <TabsList className="grid grid-cols-4 lg:grid-cols-6 w-full">
          {lessonFields.slice(0, 6).map((field) => (
            <TabsTrigger key={field.key} value={field.key}>
              {field.label.split(" ")[0]}
            </TabsTrigger>
          ))}
        </TabsList>
        {lessonFields.map((field) => {
          const content =
            (adaptedLesson as any)?.[field.key] || (lesson as any)[field.key];
          if (!content) return null;
          return (
            <TabsContent key={field.key} value={field.key} className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>{field.label}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="prose max-w-none whitespace-pre-wrap">
                    {content}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          );
        })}
      </Tabs>

      <div className="mt-6 space-y-4">
        {lessonFields.map((field) => {
          const content =
            (adaptedLesson as any)?.[field.key] || (lesson as any)[field.key];
          if (!content) return null;
          return (
            <Card key={field.key}>
              <CardHeader>
                <CardTitle className="text-lg">{field.label}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="prose max-w-none whitespace-pre-wrap">
                  {content}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function AdaptLessonButton({ lessonId }: { lessonId: string }) {
  return (
    <form
      action={async () => {
        "use server";
        // TODO: Implement AI adaptation flow
        console.log("Adapt lesson:", lessonId);
      }}
    >
      <Button type="submit">Adapt with AI</Button>
    </form>
  );
}
