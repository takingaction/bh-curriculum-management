"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CompactLessonAssets } from "@/components/lesson-assets-panel";
import { PresentationLink } from "@/components/presentation-modal";
import { SpotifyEmbed } from "@/components/spotify-embed";
import { Download, X, Volume2 } from "lucide-react";
import { FindReplacePanel } from "@/components/find-replace-panel";

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
  presentation_name: string | null;
  presentation_url: string | null;
}

interface Course {
  id: string;
  title: string;
  discipline: string;
  grade: string;
  image_url: string | null;
  spotify_embed_code: string | null;
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
  const [showSpotify, setShowSpotify] = useState(false);
  const [previewAsset, setPreviewAsset] = useState<any>(null);
  const [lessonAssets, setLessonAssets] = useState<any[]>([]);

  useEffect(() => {
    params.then(async (p) => {
      try {
        const [lessonRes, viewAsRes, assetsRes] = await Promise.all([
          fetch(`/api/lessons/${p.lessonId}`),
          fetch('/api/view-as'),
          fetch(`/api/lessons/${p.lessonId}/assets`),
        ]);
        if (!lessonRes.ok) throw new Error("Lesson not found");
        const data = await lessonRes.json();
        const viewAsData = await viewAsRes.json();
        const isAdminView = viewAsData.viewAs === 'admin';

        let assetsData: any = { assets: [] };
        if (assetsRes.ok) {
          assetsData = await assetsRes.json();
        }

        setLesson(data.lesson);
        setCourse(data.course);
        setIsAdmin(isAdminView);
        setLessonAssets(assetsData.assets || []);
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
        onClick={(e) => {
          const target = e.target as HTMLElement;
          const anchor = target.closest("a.resource-link");
          if (anchor) {
            e.preventDefault();
            const href = anchor.getAttribute("href");
            if (href) {
              const asset = lessonAssets.find((a) => a.public_url === href);
              if (asset) {
                setPreviewAsset(asset);
              }
            }
          }
        }}
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
            {/* Image - 250px fixed */}
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

            {/* Title Info - 40% width */}
            <div className="w-[40%] flex-shrink-0 flex flex-col justify-start py-2">
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

              <div className="flex gap-4 mt-4">
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

            {/* Lesson Materials - 60% width */}
            <div className="flex-1 flex flex-col justify-start py-2">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Lesson Materials</h3>
              <CompactLessonAssets lessonId={lesson.id} maxItems={6} />
              {lesson.presentation_name && (
                <div className="mt-2 pt-2 border-t border-gray-200">
                  <PresentationLink name={lesson.presentation_name} url={lesson.presentation_url || ""} />
                </div>
              )}
              {course?.spotify_embed_code && (
                <div className="mt-1">
                  <button
                    type="button"
                    onClick={() => setShowSpotify(true)}
                    className="flex items-center gap-1.5 text-xs text-[#0d7377] hover:underline"
                  >
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
                    </svg>
                    Spotify Playlist
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

{/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-2">
        {isAdmin && (
          <FindReplacePanel
            lessonId={lesson.id}
            courseId={lesson.course_id}
            isAdmin={isAdmin}
          />
        )}
        <div className="flex gap-6">
          {/* Left Navigation - Sticky */}
          <div className="w-[250px] flex-shrink-0 sticky top-0 self-start">
            <div className="space-y-1">
              {contentSections.map((section) => (
                <a
                  key={section.key}
                  href={`#${section.key}`}
                  className="block px-2 py-1 text-xs font-medium bg-[#d7ffef] text-black hover:bg-[#c7efe0] transition-colors"
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

      <SpotifyEmbed
        open={showSpotify}
        onClose={() => setShowSpotify(false)}
        embedCode={course?.spotify_embed_code || ""}
      />

      {previewAsset && (
        <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-8">
          <div className="absolute top-4 right-4 flex gap-2">
            <button
              type="button"
              onClick={() => {
                const link = document.createElement("a");
                link.href = previewAsset.public_url;
                link.download = previewAsset.display_name;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
              }}
              className="p-2 bg-white rounded-full hover:bg-gray-100"
            >
              <Download className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => setPreviewAsset(null)}
              className="p-2 bg-white rounded-full hover:bg-gray-100"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          {previewAsset.file_type === "pdf" ? (
            <iframe
              src={previewAsset.public_url}
              className="w-full h-full max-w-4xl max-h-full bg-white"
              title={previewAsset.display_name}
            />
          ) : ["mp4", "mov", "m4a"].includes(previewAsset.file_type) ? (
            <video
              src={previewAsset.public_url}
              controls
              autoPlay
              className="max-w-full max-h-full"
            />
          ) : ["mp3", "m4a", "wav"].includes(previewAsset.file_type) ? (
            <div className="bg-white rounded-lg p-8 flex flex-col items-center gap-4">
              <Volume2 className="w-16 h-16 text-gray-400" />
              <p className="text-lg font-medium">{previewAsset.display_name}</p>
              <audio
                src={previewAsset.public_url}
                controls
                autoPlay
                className="w-64"
              />
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}