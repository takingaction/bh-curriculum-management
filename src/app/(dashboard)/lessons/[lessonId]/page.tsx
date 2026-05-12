"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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

interface Course {
  id: string;
  title: string;
  discipline: string;
  grade: string;
  image_url: string | null;
}

const sections = [
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
  const [activeSection, setActiveSection] = useState("overview");
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
    if (key === "overview") {
      const duration = lesson.total_time ? `${lesson.total_time} minutes` : "Not specified";
      return `**Lesson ${lesson.lesson_number}: ${lesson.title}**\n\nDuration: ${duration}`;
    }
    return (lesson as any)[key] || "";
  };

  const renderContent = (content: string) => {
    if (!content) return <p className="text-[#666666] italic">No content available</p>;
    return (
      <div className="prose prose-sm max-w-none lesson-content">
        <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>{content}</ReactMarkdown>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Top Header */}
      <div className="border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex gap-6">
            {/* Image */}
            <div className="w-[35%] aspect-square bg-[#d7ffef] flex items-center justify-center rounded-none overflow-hidden">
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
            <div className="flex-1 flex flex-col justify-between py-2">
              <h1 className="text-3xl font-bold text-black">{lesson.title}</h1>

              <div>
                <div className="bg-[#e37c64] text-black px-3 py-2 text-sm font-medium">
                  LESSON PLAN: CLASS {lesson.lesson_number}
                </div>

                <div className="text-sm text-black uppercase tracking-wide">
                  {course.title} | Grade {course.grade}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex gap-0 min-h-[600px]">
          {/* Left Navigation */}
          <div className="w-[250px] flex-shrink-0">
            <div className="space-y-1">
              {sections.map((section) => (
                <button
                  key={section.key}
                  onClick={() => setActiveSection(section.key)}
                  className={`w-full text-left px-4 py-3 text-sm font-medium transition-colors ${
                    activeSection === section.key
                      ? "bg-[#ecb0a1] text-black"
                      : "bg-[#d7ffef] text-black hover:bg-[#c7efe0]"
                  }`}
                >
                  {section.label}
                </button>
              ))}
            </div>
          </div>

          {/* Right Content */}
          <div className="flex-1 border-l border-gray-200">
            <div className="p-6">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="bg-[#e37c64] text-black text-left px-4 py-3 font-semibold uppercase">
                      {sections.find((s) => s.key === activeSection)?.label}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="bg-white text-black px-4 py-4 align-top">
                      {renderContent(getContent(activeSection))}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4 flex gap-4">
          <Link
            href={isAdmin ? `/admin/courses/${course.id}` : `/teacher/courses/${course.id}`}
            className="text-[#0d7377] hover:underline text-sm"
          >
            ← Back to Course
          </Link>
          <Link href={isAdmin ? "/admin" : "/teacher"} className="text-[#0d7377] hover:underline text-sm">
            Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}