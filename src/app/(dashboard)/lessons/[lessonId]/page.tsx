"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LessonAssetsPanel } from "@/components/lesson-assets-panel";

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

interface Course {
  id: string;
  title: string;
  discipline: string;
  grade: string;
  image_url: string | null;
}

const sections = [
  { key: "lesson_outline", label: "Lesson Outline" },
  { key: "learning_objectives", label: "Learning Objectives" },
  { key: "vocabulary", label: "Vocabulary" },
  { key: "materials", label: "Materials" },
  { key: "vapa_text_block", label: "VAPA Standards" },
  { key: "ncas_text_block", label: "NCAS Standards" },
  { key: "welcome_opening", label: "Welcome and Opening Check-In" },
  { key: "actual_class_expectations", label: "Class Expectations and Procedures" },
  { key: "warm_up", label: "Warm Up" },
  { key: "lesson_hook", label: 'Lesson "Hook"' },
  { key: "main_activity", label: "Main Activity" },
  { key: "instrument_expectations", label: "Instrument Expectations" },
  { key: "reflection", label: "Reflection" },
  { key: "closing_ceremony", label: "Closing Ceremony" },
  { key: "assessment", label: "Assessment" },
];

export default function LessonContentPage({
  params,
}: {
  params: Promise<{ lessonId: string }>;
}) {
  const router = useRouter();
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    params.then(async (p) => {
      try {
        const [lessonRes, viewAsRes] = await Promise.all([
          fetch(`/api/lessons/${p.lessonId}`),
          fetch('/api/view-as'),
        ]);
        if (!lessonRes.ok) throw new Error("Lesson not found");
        const data = await lessonRes.json();
        const viewAsData = await viewAsRes.json();
        const isAdminView = viewAsData.viewAs === 'admin';

        setLesson(data.lesson);
        setCourse(data.course);
        setIsAdmin(isAdminView);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    });
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-[#2d2d2d]">Loading...</div>
      </div>
    );
  }

  if (error || !lesson || !course) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-[#e85d5d] mb-4">{error || "Lesson not found"}</p>
          <Link href="/teacher" className="text-[#0d7377] hover:underline">
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const getContent = (key: string): string => {
    return (lesson as any)[key] || "";
  };

  const renderContent = (content: string) => {
    if (!content) return <p className="text-[#666666] italic">No content available</p>;
    return (
      <div
        className="prose prose-sm max-w-none lesson-content"
        dangerouslySetInnerHTML={{ __html: content }}
      />
    );
  };

  const hasContent = (key: string): boolean => {
    return !!(lesson as any)[key];
  };

  const contentSections = sections.filter(s => hasContent(s.key));

  return (
    <div className="min-h-screen bg-white">
      <style jsx global>{`
        html { scroll-behavior: smooth; }
      `}</style>

      {/* Top Header */}
      <div className="border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex gap-6">
            {/* Image - Same width as nav buttons */}
            <div className="w-[250px] h-[250px] bg-[#d7ffef] flex items-center justify-center rounded-none overflow-hidden flex-shrink-0">
              {course.image_url ? (
                <img
                  src={course.image_url}
                  alt={course.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-[#666666] text-sm">No Image</span>
              )}
            </div>

            {/* Title Info */}
            <div className="flex-1 flex flex-col justify-start py-2 -mt-2">
              <div>
                <div className="text-sm text-black uppercase tracking-wide">
                  {course.title} | Grade {course.grade}
                </div>
                <div className="text-base font-bold text-black uppercase tracking-wide mt-2">
                  Lesson Plan: Class {lesson.lesson_number}
                </div>
                <h1 className="text-3xl font-bold text-black">{lesson.title}</h1>
                <div className="text-sm text-black normal-case tracking-normal mt-1">
                  {lesson.total_time ? `Duration: ${lesson.total_time} minutes` : ""}
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-gray-200">
                <LessonAssetsPanel lessonId={lesson.id} canEdit={false} />
              </div>

              <div className="flex gap-4 mt-2">
                <Link
                  href={isAdmin ? `/admin/courses/${course.id}` : `/teacher/courses/${course.id}`}
                  className="text-[#0d7377] hover:underline text-sm"
                >
                  ← Back to Course
                </Link>
                <Link href={isAdmin ? "/admin" : "/teacher"} className="text-[#0d7377] hover:underline text-sm">
                  Back to Dashboard
                </Link>
                {isAdmin && (
                  <Link
                    href={`/admin/courses/${course.id}/lessons/${lesson.id}`}
                    className="text-[#e85d5d] hover:underline text-sm font-medium"
                  >
                    Edit Lesson
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-2">
        <div className="flex gap-6">
          {/* Left Navigation - Sticky */}
          <div className="w-[250px] flex-shrink-0 sticky top-0 self-start">
            <div className="space-y-1">
              {contentSections.map((section) => (
                <a
                  key={section.key}
                  href={`#${section.key}`}
                  className="block px-4 py-1 text-sm font-medium bg-[#d7ffef] text-black hover:bg-[#c7efe0] transition-colors"
                >
                  {section.label}
                </a>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-gray-200 space-y-1">
              <Link
                href={isAdmin ? `/admin/courses/${course.id}` : `/teacher/courses/${course.id}`}
                className="block text-xs text-[#0d7377] hover:underline"
              >
                ← Back to Course
              </Link>
              <Link href={isAdmin ? "/admin" : "/teacher"} className="block text-xs text-[#0d7377] hover:underline">
                Back to Dashboard
              </Link>
              {isAdmin && (
                <Link
                  href={`/admin/courses/${course.id}/lessons/${lesson.id}`}
                  className="block text-xs text-[#e85d5d] hover:underline"
                >
                  Edit Lesson
                </Link>
              )}
            </div>
          </div>

          {/* Right Content - All sections stacked */}
          <div className="flex-1">
            {contentSections.map((section) => (
              <div key={section.key} id={section.key} className="mb-6">
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      <th className="bg-[#e37c64] text-white text-left px-4 py-3 font-semibold uppercase">
                        {section.label}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="bg-white text-black px-4 py-4 align-top">
                        {renderContent(getContent(section.key))}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
}