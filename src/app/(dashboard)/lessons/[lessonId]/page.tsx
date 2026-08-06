"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CompactLessonAssets } from "@/components/lesson-assets-panel";
import { PresentationLink } from "@/components/presentation-modal";
import { SpotifyEmbed } from "@/components/spotify-embed";
import YouTubeDialog from "@/components/youtube-dialog";
import { TrialPdfModal } from "@/components/trial-pdf-modal";
import { Download, X, Volume2, EyeIcon, FileTextIcon, VideoIcon, DownloadIcon, List } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { FindReplacePanel } from "@/components/find-replace-panel";
import { LessonNavigation } from "@/components/lesson-navigation";
import { SetChatContext } from "@/components/set-chat-context";

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

interface Profile {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  california: boolean | null;
  enrollment_status: string | null;
  trial_ends_at: string | null;
  role: string;
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
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [showSpotify, setShowSpotify] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  const [showTrialPdfModal, setShowTrialPdfModal] = useState(false);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [previewAsset, setPreviewAsset] = useState<any>(null);
  const [lessonAssets, setLessonAssets] = useState<any[]>([]);
  const [courseAssets, setCourseAssets] = useState<any[]>([]);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [pdfExists, setPdfExists] = useState(false);
  const [sectionPickerOpen, setSectionPickerOpen] = useState(false);

  const isBlocked = profile?.enrollment_status === "inactive" ||
    (profile?.enrollment_status === "trial" && 
     profile?.trial_ends_at && 
     new Date(profile?.trial_ends_at) < new Date());
  const showCalifornia = profile?.california !== false;

  useEffect(() => {
    if (isBlocked && !loading) {
      router.push("/dashboard");
    }
  }, [isBlocked, loading]);

  useEffect(() => {
    params.then(async (p) => {
      try {
        const [lessonRes, viewAsRes, assetsRes, profileRes] = await Promise.all([
          fetch(`/api/lessons/${p.lessonId}`),
          fetch('/api/view-as'),
          fetch(`/api/lessons/${p.lessonId}/assets`),
          fetch('/api/profile/check-status'),
        ]);
        if (!lessonRes.ok) throw new Error("Lesson not found");
        const data = await lessonRes.json();
        const viewAsData = await viewAsRes.json();
        const isAdminView = viewAsData.viewAs === 'admin';

        let assetsData: any = { assets: [] };
        if (assetsRes.ok) {
          assetsData = await assetsRes.json();
        }

        let profileData: any = null;
        if (profileRes.ok) {
          profileData = await profileRes.json();
        }

        setLesson(data.lesson);
        setCourse(data.course);
        setIsAdmin(isAdminView || profileData?.profile?.role === 'admin');
        setLessonAssets(assetsData.assets || []);
        if (profileData?.profile) {
          setProfile(profileData.profile);
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    });
  }, []);

  useEffect(() => {
    if (lesson?.id && profile?.id) {
      fetch("/api/activity/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: profile.id,
          action: "view_lesson",
          resource_id: lesson.id,
        }),
      }).catch((err) => console.error("Failed to log lesson view:", err));
    }
  }, [lesson?.id, profile?.id]);

  useEffect(() => {
    if (lesson?.course_id) {
      fetch(`/api/courses/${lesson.course_id}/assets`)
        .then((res) => res.json())
        .then((data) => {
          if (data.assets) {
            setCourseAssets(data.assets);
          }
        })
        .catch((error) => {
          console.error("Failed to fetch course assets:", error);
        });
    }
  }, [lesson]);

  useEffect(() => {
    if (lesson?.id) {
      fetch(`/api/lessons/${lesson.id}/pdf/info`)
        .then(res => res.json())
        .then(data => setPdfExists(data.exists === true))
        .catch(() => setPdfExists(false));
    }
  }, [lesson]);

  useEffect(() => {
    if (!loading && typeof window !== 'undefined') {
      const hash = window.location.hash;
      if (hash) {
        const sectionKey = hash.replace('#', '');
        setActiveSection(sectionKey);
        const element = document.getElementById(sectionKey);
        if (element) {
          setTimeout(() => {
            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }, 100);
        }
      }
    }
  }, [loading]);

  useEffect(() => {
    if (loading) return;
    const handleScroll = () => {
      const scrollPosition = window.scrollY + 200;
      for (const section of filteredSections) {
        if (!lesson?.[section.key as keyof Lesson]) continue;
        const element = document.getElementById(section.key);
        if (element) {
          const { offsetTop, offsetHeight } = element;
          if (scrollPosition >= offsetTop && scrollPosition < offsetTop + offsetHeight) {
            setActiveSection(section.key);
            break;
          }
        }
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [loading, lesson, showCalifornia]);

  useEffect(() => {
    const handleBackToTopVisibility = () => {
      setShowBackToTop(window.scrollY > 500);
    };
    window.addEventListener('scroll', handleBackToTopVisibility);
    return () => window.removeEventListener('scroll', handleBackToTopVisibility);
  }, []);

  const filteredSections = sections.filter(section => {
    if (section.key === "vapa_text_block" && !showCalifornia) return false;
    if (section.key === "ncas_text_block" && showCalifornia) return false;
    return true;
  });

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
          const anchor = target.closest("a");
          if (anchor) {
            const href = anchor.getAttribute("href");
            if (!href) return;

            if (anchor.classList.contains("spotify-playlist-link")) {
              e.preventDefault();
              setShowSpotify(true);
            } else if (anchor.classList.contains("resource-link")) {
              e.preventDefault();
              const asset = lessonAssets.find((a) => a.public_url === href);
              if (asset) {
                setPreviewAsset(asset);
              }
            } else if (anchor.classList.contains("section-link") && href.startsWith("#")) {
              e.preventDefault();
              const sectionKey = href.replace('#', '');
              setActiveSection(sectionKey);
              const element = document.getElementById(sectionKey);
              if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                window.history.pushState(null, '', href);
              }
            } else if (anchor.classList.contains("youtube-link") || href.includes('youtube.com') || href.includes('youtu.be')) {
              e.preventDefault();
              setVideoUrl(href);
              setShowVideo(true);
            }
          }
        }}
      />
    );
  };

  const hasContent = (key: string): boolean => {
    return !!(lesson as any)[key];
  };

  const contentSections = filteredSections.filter(s => hasContent(s.key));

  const isTrial = profile?.enrollment_status === "trial";

  const handlePdfClick = (e: React.MouseEvent, download: boolean) => {
    if (isBlocked || isTrial) {
      e.preventDefault();
      setShowTrialPdfModal(true);
    } else if (download) {
      // Allow download
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {lesson && course && (
        <SetChatContext lessonId={lesson.id} courseId={course.id} />
      )}
      <style jsx global>{`
        html { scroll-behavior: smooth; }
      `}</style>

      <div className="border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex flex-col md:flex-row md:gap-6 gap-4">
            <div className="w-[30%] h-[30vw] md:w-[250px] md:h-[250px] bg-[#d7ffef] flex items-center justify-center rounded-none overflow-hidden flex-shrink-0">
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

            <div className="w-full md:w-[40%] md:flex-shrink-0 flex flex-col justify-start py-2">
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
                  href={`/dashboard/courses/${course.id}`}
                  className="text-[#0d7377] hover:underline text-sm"
                >
                  ← Back to Course
                </Link>
                <Link href="/dashboard" className="text-[#0d7377] hover:underline text-sm">
                  Back to Dashboard
                </Link>
                {isAdmin && (
                  <>
                    <Link
                      href={`/admin/courses/${course.id}`}
                      className="text-[#e85d5d] hover:underline text-sm font-medium"
                    >
                      Edit Course
                    </Link>
                    <Link
                      href={`/admin/courses/${course.id}/lessons/${lesson.id}`}
                      className="text-[#e85d5d] hover:underline text-sm font-medium"
                    >
                      Edit Lesson
                    </Link>
                  </>
                )}
              </div>
              <div className="mt-4">
                {pdfExists && (
                  <div className="mb-2 text-sm">
                    {(isBlocked || isTrial) ? (
                      <>
                        <button
                          type="button"
                          onClick={() => setShowTrialPdfModal(true)}
                          className="text-[#0d7377] hover:underline"
                        >
                          View PDF
                        </button>
                        {" | "}
                        <button
                          type="button"
                          onClick={() => setShowTrialPdfModal(true)}
                          className="text-[#0d7377] hover:underline"
                        >
                          Download PDF
                        </button>
                      </>
                    ) : (
                      <>
                        <a
                          href={`/api/lessons/${lesson.id}/pdf?download=false`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#0d7377] hover:underline"
                          onClick={(e) => handlePdfClick(e, false)}
                        >
                          View PDF
                        </a>
                        {" | "}
                        <a
                          href={`/api/lessons/${lesson.id}/pdf?download=true`}
                          download
                          className="text-[#0d7377] hover:underline"
                          onClick={(e) => handlePdfClick(e, true)}
                        >
                          Download PDF
                        </a>
                      </>
                    )}
                  </div>
                )}
                <LessonNavigation
                  courseId={course.id}
                  currentLessonId={lesson.id}
                  admin={false}
                />
              </div>
            </div>

            <div className="w-full flex-1 flex flex-col justify-start py-2">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Lesson Resources</h3>
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

              {courseAssets.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">Course Materials</h3>
                  <div className="space-y-0">
                    {courseAssets.slice(0, 6).map((asset) => {
                      const Icon = asset.file_type === 'pdf' ? FileTextIcon :
                        ['mp4', 'mov'].includes(asset.file_type) ? VideoIcon :
                        ['mp3', 'm4a', 'wav'].includes(asset.file_type) ? Volume2 :
                        FileTextIcon;
                      return (
                        <div key={asset.id} className="flex items-center gap-2 py-0.5">
                          <Icon className="w-3 h-3 text-gray-500 flex-shrink-0" />
                          <span className="text-xs text-black truncate" title={asset.display_name}>
                            {asset.display_name}
                          </span>
                          <div className="flex items-center gap-0.5 ml-auto">
                            <button
                              type="button"
                              onClick={() => setPreviewAsset(asset)}
                              className="p-1 hover:bg-gray-200 rounded text-gray-500"
                              title="Preview"
                            >
                              <EyeIcon className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => window.open(asset.public_url, "_blank")}
                              className="p-1 hover:bg-gray-200 rounded text-gray-500"
                              title="Download"
                            >
                              <DownloadIcon className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                    {courseAssets.length > 6 && (
                      <p className="text-xs text-gray-500 py-1">+{courseAssets.length - 6} more</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-2">
        {isAdmin && (
          <FindReplacePanel
            lessonId={lesson.id}
            courseId={lesson.course_id}
            isAdmin={isAdmin}
          />
        )}
        <div className="flex gap-6">
          <div className="hidden md:block w-[250px] flex-shrink-0 sticky top-0 self-start">
            <div className="space-y-1">
              {contentSections.map((section) => (
                <a
                  key={section.key}
                  href={`#${section.key}`}
                  onClick={(e) => {
                    e.preventDefault();
                    setActiveSection(section.key);
                    const element = document.getElementById(section.key);
                    if (element) {
                      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      window.history.pushState(null, '', `#${section.key}`);
                    }
                  }}
                  className={`block px-2 py-1 text-xs font-medium transition-colors ${
                    activeSection === section.key
                      ? 'bg-[#0d7377] text-white'
                      : 'bg-[#d7ffef] text-black hover:bg-[#c7efe0]'
                  }`}
                >
                  {section.label}
                </a>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-gray-200 space-y-1">
              <Link
                href={`/dashboard/courses/${course.id}`}
                className="block text-xs text-[#0d7377] hover:underline"
              >
                ← Back to Course
              </Link>
              <Link href="/dashboard" className="block text-xs text-[#0d7377] hover:underline">
                Back to Dashboard
              </Link>
              {isAdmin && (
                <>
                  <Link
                    href={`/admin/courses/${course.id}`}
                    className="block text-xs text-[#e85d5d] hover:underline"
                  >
                    Edit Course
                  </Link>
                  <Link
                    href={`/admin/courses/${course.id}/lessons/${lesson.id}`}
                    className="block text-xs text-[#e85d5d] hover:underline"
                  >
                    Edit Lesson
                  </Link>
                </>
              )}
            </div>
          </div>

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

      {showVideo && videoUrl && (
        <YouTubeDialog videoUrl={videoUrl} onClose={() => { setShowVideo(false); setVideoUrl(null); }} />
      )}

      <TrialPdfModal
        open={showTrialPdfModal}
        onClose={() => setShowTrialPdfModal(false)}
      />

      {showBackToTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-6 left-6 w-12 h-12 rounded-full bg-[#0d7377] text-white shadow-lg hover:bg-[#0a5c5f] flex items-center justify-center z-50"
          aria-label="Back to top"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="18 15 12 9 6 15" />
          </svg>
        </button>
      )}

      <Sheet open={sectionPickerOpen} onOpenChange={setSectionPickerOpen}>
        <SheetTrigger className="md:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-14 h-14 rounded-full bg-[#0d7377] text-white shadow-lg hover:bg-[#0a5c5f] flex items-center justify-center">
          <List className="w-6 h-6" />
        </SheetTrigger>
        <SheetContent side="bottom" className="max-h-[70vh] overflow-y-auto rounded-t-2xl">
          <SheetHeader>
            <SheetTitle className="text-left">Go to Section</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-1">
            {contentSections.map((section) => (
              <button
                key={section.key}
                type="button"
                onClick={() => {
                  setActiveSection(section.key);
                  setSectionPickerOpen(false);
                  const element = document.getElementById(section.key);
                  if (element) {
                    element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    window.history.pushState(null, '', `#${section.key}`);
                  }
                }}
                className={`w-full text-left px-3 py-2.5 text-sm font-medium transition-colors rounded-lg ${
                  activeSection === section.key
                    ? 'bg-[#0d7377] text-white'
                    : 'bg-[#d7ffef] text-black hover:bg-[#c7efe0]'
                }`}
              >
                {section.label}
              </button>
            ))}
          </div>
        </SheetContent>
      </Sheet>

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
