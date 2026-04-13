"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

export default function EditLessonPage({
  params,
}: {
  params: Promise<{ id: string; lessonId: string }>;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [lesson, setLesson] = useState<any>(null);
  const [fields, setFields] = useState({
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
      const { data } = await supabase
        .from("lessons")
        .select("*")
        .eq("id", p.lessonId)
        .single();
      if (data) {
        setLesson(data);
        setFields({
          lesson_number: data.lesson_number || "",
          title: data.title || "",
          total_time: data.total_time || "",
          lesson_outline: data.lesson_outline || "",
          learning_objectives: data.learning_objectives || "",
          vocabulary: data.vocabulary || "",
          materials: data.materials || "",
          vapa_text_block: data.vapa_text_block || "",
          ncas_text_block: data.ncas_text_block || "",
          welcome_opening: data.welcome_opening || "",
          actual_class_expectations: data.actual_class_expectations || "",
          lesson_hook: data.lesson_hook || "",
          warm_up: data.warm_up || "",
          main_activity: data.main_activity || "",
          instrument_expectations: data.instrument_expectations || "",
          reflection: data.reflection || "",
          closing_ceremony: data.closing_ceremony || "",
          assessment: data.assessment || "",
        });
      }
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lesson) return;
    setLoading(true);
    setError("");

    const { error } = await supabase
      .from("lessons")
      .update(fields)
      .eq("id", lesson.id);

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push(`/admin/courses/${lesson.course_id}`);
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setFields((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  if (!lesson) return <div>Loading...</div>;

  const textFields = [
    { name: "lesson_outline", label: "Lesson Outline" },
    { name: "learning_objectives", label: "Learning Objectives" },
    { name: "vocabulary", label: "Vocabulary" },
    { name: "materials", label: "Materials" },
    { name: "vapa_text_block", label: "VAPA Text Block" },
    { name: "ncas_text_block", label: "NCAS Text Block" },
    { name: "welcome_opening", label: "Welcome Opening" },
    { name: "actual_class_expectations", label: "Class Expectations" },
    { name: "lesson_hook", label: "Lesson Hook" },
    { name: "warm_up", label: "Warm Up" },
    { name: "main_activity", label: "Main Activity" },
    { name: "instrument_expectations", label: "Instrument Expectations" },
    { name: "reflection", label: "Reflection" },
    { name: "closing_ceremony", label: "Closing Ceremony" },
    { name: "assessment", label: "Assessment" },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h2 className="text-2xl font-bold">Edit Lesson</h2>
        <p className="text-gray-600">{fields.title}</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-3 text-sm text-red-600 bg-red-50 rounded-md">
                {error}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="lesson_number">Lesson Number</Label>
                <Input
                  id="lesson_number"
                  name="lesson_number"
                  type="number"
                  min="1"
                  value={fields.lesson_number}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  name="title"
                  value={fields.title}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="total_time">Total Time</Label>
              <Input
                id="total_time"
                name="total_time"
                placeholder="e.g., 45 minutes"
                value={fields.total_time}
                onChange={handleChange}
              />
            </div>

            {textFields.map((field) => (
              <div key={field.name} className="space-y-2">
                <Label htmlFor={field.name}>{field.label}</Label>
                <Textarea
                  id={field.name}
                  name={field.name}
                  value={fields[field.name as keyof typeof fields]}
                  onChange={handleChange}
                  rows={4}
                />
              </div>
            ))}

            <div className="flex gap-4">
              <Button type="submit" disabled={loading}>
                {loading ? "Saving..." : "Save Changes"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={async () => {
                  if (confirm("Delete this lesson?")) {
                    await supabase.from("lessons").delete().eq("id", lesson.id);
                    router.push(`/admin/courses/${lesson.course_id}`);
                  }
                }}
              >
                Delete
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
