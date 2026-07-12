"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface LessonSummary {
  id: string;
  lesson_number: number;
  title: string;
}

interface LessonNavigationProps {
  courseId: string;
  currentLessonId: string;
  admin?: boolean;
}

export function LessonNavigation({ courseId, currentLessonId, admin = false }: LessonNavigationProps) {
  const router = useRouter();
  const [lessons, setLessons] = useState<LessonSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const [prevLesson, setPrevLesson] = useState<LessonSummary | null>(null);
  const [nextLesson, setNextLesson] = useState<LessonSummary | null>(null);

  useEffect(() => {
    async function fetchLessons() {
      try {
        const res = await fetch(`/api/courses/${courseId}/lessons`);
        if (!res.ok) throw new Error("Failed to fetch lessons");
        const data = await res.json();
        setLessons(data.lessons || []);

        const currentIndex = data.lessons?.findIndex(
          (l: LessonSummary) => l.id === currentLessonId
        );

        if (currentIndex !== undefined && currentIndex !== -1) {
          if (currentIndex > 0) {
            setPrevLesson(data.lessons[currentIndex - 1]);
          }
          if (currentIndex < data.lessons.length - 1) {
            setNextLesson(data.lessons[currentIndex + 1]);
          }
        }
      } catch (err) {
        console.error("Error fetching lessons for navigation:", err);
      } finally {
        setLoading(false);
      }
    }

    if (courseId && currentLessonId) {
      fetchLessons();
    }
  }, [courseId, currentLessonId]);

  const navigateToLesson = (lessonId: string) => {
    if (admin) {
      router.push(`/admin/courses/${courseId}/lessons/${lessonId}`);
    } else {
      router.push(`/lessons/${lessonId}`);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2">
        <div className="w-20 h-8 bg-gray-100 rounded animate-pulse" />
        <div className="w-20 h-8 bg-gray-100 rounded animate-pulse" />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => prevLesson && navigateToLesson(prevLesson.id)}
        disabled={!prevLesson}
        className={`flex items-center gap-1 text-xs ${
          !prevLesson
            ? "text-gray-300 border-gray-200 cursor-not-allowed opacity-50"
            : "text-[#0d7377] border-[#e5e5e0] hover:bg-[#d7ffef]"
        }`}
      >
        <ChevronLeft className="w-3 h-3" />
        Previous Lesson
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => nextLesson && navigateToLesson(nextLesson.id)}
        disabled={!nextLesson}
        className={`flex items-center gap-1 text-xs ${
          !nextLesson
            ? "text-gray-300 border-gray-200 cursor-not-allowed opacity-50"
            : "text-[#0d7377] border-[#e5e5e0] hover:bg-[#d7ffef]"
        }`}
      >
        Next Lesson
        <ChevronRight className="w-3 h-3" />
      </Button>
    </div>
  );
}
