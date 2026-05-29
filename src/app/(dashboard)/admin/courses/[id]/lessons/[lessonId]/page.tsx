"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { LessonEditor } from "@/components/editor/lesson-editor";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";

interface Lesson {
  id: string;
  course_id: string;
  lesson_number: number;
  title: string;
  total_time: string | null;
  lesson_outline: string | null;
  learning_objectives: string | null;
  vocabulary: string | null;
  materials: string | null;
  vapa_text_block: string | null;
  ncas_text_block: string | null;
  welcome_opening: string | null;
  actual_class_expectations: string | null;
  lesson_hook: string | null;
  warm_up: string | null;
  main_activity: string | null;
  instrument_expectations: string | null;
  reflection: string | null;
  closing_ceremony: string | null;
  assessment: string | null;
}

interface Fields {
  lesson_number: string;
  title: string;
  total_time: string;
  lesson_outline: string;
  learning_objectives: string;
  vocabulary: string;
  materials: string;
  vapa_text_block: string;
  ncas_text_block: string;
  welcome_opening: string;
  actual_class_expectations: string;
  lesson_hook: string;
  warm_up: string;
  main_activity: string;
  instrument_expectations: string;
  reflection: string;
  closing_ceremony: string;
  assessment: string;
}

const textFields = [
  { name: "lesson_outline", label: "Lesson Outline" },
  { name: "learning_objectives", label: "Learning Objectives" },
  { name: "vocabulary", label: "Vocabulary" },
  { name: "materials", label: "Materials" },
  { name: "vapa_text_block", label: "VAPA Standards" },
  { name: "ncas_text_block", label: "NCAS Standards" },
  { name: "welcome_opening", label: "Welcome and Opening Check-In" },
  { name: "actual_class_expectations", label: "Class Expectations and Procedures" },
  { name: "lesson_hook", label: 'Lesson "Hook"' },
  { name: "warm_up", label: "Warm Up" },
  { name: "main_activity", label: "Main Activity" },
  { name: "instrument_expectations", label: "Instrument Expectations" },
  { name: "reflection", label: "Reflection" },
  { name: "closing_ceremony", label: "Closing Ceremony" },
  { name: "assessment", label: "Assessment" },
];

export default function EditLessonPage({
  params,
}: {
  params: Promise<{ id: string; lessonId: string }>;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [course, setCourse] = useState<{ title: string; discipline: string; grade: string; image_url: string | null } | null>(null);
  const [fields, setFields] = useState<Fields>({
    lesson_number: "",
    title: "",
    total_time: "",
    lesson_outline: "",
    learning_objectives: "",
    vocabulary: "",
    materials: "",
    vapa_text_block: "",
    ncas_text_block: "",
    welcome_opening: "",
    actual_class_expectations: "",
    lesson_hook: "",
    warm_up: "",
    main_activity: "",
    instrument_expectations: "",
    reflection: "",
    closing_ceremony: "",
    assessment: "",
  });

  useEffect(() => {
    params.then(async (p) => {
      try {
        const lessonRes = await fetch(`/api/admin/lessons/${p.lessonId}`);
        if (!lessonRes.ok) throw new Error("Lesson not found");
        const lessonData = await lessonRes.json();
        setLesson(lessonData);

        const courseRes = await fetch(`/api/lessons/${p.lessonId}`);
        if (courseRes.ok) {
          const courseData = await courseRes.json();
          setCourse(courseData.course);
        }

        setFields({
          lesson_number: lessonData.lesson_number?.toString() || "",
          title: lessonData.title || "",
          total_time: lessonData.total_time || "",
          lesson_outline: lessonData.lesson_outline || "",
          learning_objectives: lessonData.learning_objectives || "",
          vocabulary: lessonData.vocabulary || "",
          materials: lessonData.materials || "",
          vapa_text_block: lessonData.vapa_text_block || "",
          ncas_text_block: lessonData.ncas_text_block || "",
          welcome_opening: lessonData.welcome_opening || "",
          actual_class_expectations: lessonData.actual_class_expectations || "",
          lesson_hook: lessonData.lesson_hook || "",
          warm_up: lessonData.warm_up || "",
          main_activity: lessonData.main_activity || "",
          instrument_expectations: lessonData.instrument_expectations || "",
          reflection: lessonData.reflection || "",
          closing_ceremony: lessonData.closing_ceremony || "",
          assessment: lessonData.assessment || "",
        });
      } catch (err: any) {
        setError(err.message);
      } finally {
        setFetching(false);
      }
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lesson) return;
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/admin/lessons/${lesson.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...fields,
          lesson_number: parseInt(fields.lesson_number) || 1,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update");
      }

      router.push(`/admin/courses/${lesson.course_id}`);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  const handleFieldChange = (name: string, content: string) => {
    setFields((prev) => ({
      ...prev,
      [name]: content,
    }));
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const { name, value } = e.target;
    setFields((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  if (fetching) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-[#f5f5f0] rounded w-1/3" />
          <div className="h-64 bg-[#f5f5f0] rounded" />
        </div>
      </div>
    );
  }

  if (!lesson) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center">
          <p className="text-[#e85d5d]">{error || "Lesson not found"}</p>
          <Button variant="outline" onClick={() => router.back()} className="mt-4">
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <div className="flex gap-4 mb-2">
          <Link
            href={`/lessons/${lesson?.id}`}
            className="text-[#0d7377] hover:underline text-sm"
          >
            View Lesson
          </Link>
          <Link
            href={`/admin/courses/${lesson?.course_id}`}
            className="text-[#0d7377] hover:underline text-sm"
          >
            ← Back to Course
          </Link>
        </div>
        <h2 className="text-2xl font-bold text-[#2d2d2d]">Edit Lesson</h2>
        <p className="text-[#666666]">{fields.title}</p>
      </div>

      <Card className="border-[#e5e5e0] shadow-sm">
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-3 text-sm text-white bg-[#e85d5d] rounded-lg">
                {error}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="lesson_number" className="text-[#2d2d2d]">Lesson Number</Label>
                <Input
                  id="lesson_number"
                  name="lesson_number"
                  type="number"
                  min="1"
                  value={fields.lesson_number}
                  onChange={handleChange}
                  required
                  className="border-[#e5e5e0] focus:border-[#0d7377]"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="title" className="text-[#2d2d2d]">Title</Label>
                <Input
                  id="title"
                  name="title"
                  value={fields.title}
                  onChange={handleChange}
                  required
                  className="border-[#e5e5e0] focus:border-[#0d7377]"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="total_time" className="text-[#2d2d2d]">Total Time</Label>
              <Input
                id="total_time"
                name="total_time"
                placeholder="e.g., 45 minutes"
                value={fields.total_time}
                onChange={handleChange}
                className="border-[#e5e5e0] focus:border-[#0d7377]"
              />
            </div>

            {textFields.map((field) => (
              <div key={field.name} className="space-y-2">
                <Label htmlFor={field.name} className="text-[#2d2d2d] font-bold text-base">
                  {field.label}
                </Label>
                <LessonEditor
                  content={fields[field.name as keyof Fields]}
                  onChange={(content) => handleFieldChange(field.name, content)}
                  placeholder={`Enter ${field.label.toLowerCase()}...`}
                  lessonId={lesson.id}
                  courseId={lesson.course_id}
                />
              </div>
            ))}

            <div className="flex gap-4 pt-4 border-t border-[#e5e5e0]">
              <Button
                type="submit"
                disabled={loading}
                className="bg-[#0d7377] hover:bg-[#0a5c5f] text-white"
              >
                {loading ? "Saving..." : "Save Changes"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowPreview(!showPreview)}
                className={showPreview ? "bg-[#ecb0a1] border-[#ecb0a1]" : "border-[#e5e5e0]"}
              >
                {showPreview ? "Hide Preview" : "Show Preview"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
                className="border-[#e5e5e0]"
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={async () => {
                  if (confirm("Delete this lesson?")) {
                    await fetch(`/api/admin/lessons/${lesson.id}`, { method: "DELETE" });
                    router.push(`/admin/courses/${lesson.course_id}`);
                  }
                }}
              >
                Delete
              </Button>
            </div>
          </form>

          {showPreview && (
            <div className="mt-6 border-t border-[#e5e5e0] pt-6">
              <h3 className="text-lg font-semibold text-[#2d2d2d] mb-4">Preview</h3>
              <div className="border border-[#e5e5e0] rounded-none overflow-hidden">
                {/* Header */}
                <div className="flex">
                  <div className="w-[35%] aspect-square bg-[#d7ffef] flex items-center justify-center min-h-[120px]">
                    {course?.image_url ? (
                      <img src={course.image_url} alt={course.title} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-[#666666] text-sm">No Image</span>
                    )}
                  </div>
                  <div className="flex-1 p-4">
                    <h1 className="text-2xl font-bold text-black">{fields.title}</h1>
                    <div className="bg-[#e37c64] text-black px-3 py-2 text-sm font-medium mt-2">
                      LESSON PLAN: CLASS {fields.lesson_number}
                    </div>
                    <div className="text-sm text-black uppercase mt-2">
                      {course?.title || "Course"} | Grade {course?.grade || "?"}
                    </div>
                  </div>
                </div>

                {/* Content */}
                <div className="p-4">
                    <div className="flex gap-0">
                      <div className="w-[200px] space-y-1">
                        {[
                          { key: "overview", label: "Overview" },
                          { key: "lesson_outline", label: "Lesson Outline" },
                          { key: "learning_objectives", label: "Learning Objectives" },
                          { key: "vocabulary", label: "Vocabulary" },
                          { key: "materials", label: "Materials" },
                          { key: "vapa_text_block", label: "VAPA Standards" },
                          { key: "ncas_text_block", label: "NCAS Standards" },
                          { key: "welcome_opening", label: "Welcome and Opening Check-In" },
                          { key: "lesson_hook", label: 'Lesson "Hook"' },
                          { key: "actual_class_expectations", label: "Class Expectations and Procedures" },
                          { key: "warm_up", label: "Warm Up" },
                          { key: "main_activity", label: "Main Activity" },
                          { key: "instrument_expectations", label: "Instrument Expectations" },
                          { key: "assessment", label: "Assessment" },
                          { key: "reflection", label: "Reflection" },
                          { key: "closing_ceremony", label: "Closing Ceremony" },
                        ].map((section) => (
                        <button
                          key={section.key}
                          className="w-full text-left px-3 py-2 text-sm font-medium bg-[#d7ffef] text-black hover:bg-[#c7efe0]"
                        >
                          {section.label}
                        </button>
                      ))}
                    </div>
                    <div className="flex-1 border-l border-gray-200 p-4">
                      <table className="w-full">
                        <thead>
                          <tr>
                            <th className="bg-[#e37c64] text-black text-left px-4 py-2 font-semibold">
                              {fields.title}
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td className="bg-white text-black px-4 py-4 align-top">
                              <div className="prose prose-sm max-w-none">
                                <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                                  {(fields.main_activity || fields.lesson_outline || "No content")}
                                </ReactMarkdown>
                              </div>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}