"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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
import { useChatContext } from "@/components/chat-context";
import { VersionsModal } from "@/components/versions-modal";
import { SaveVersionDialog } from "@/components/save-version-dialog";
import { GeneratePdfDialog } from "@/components/generate-pdf-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { type LessonVersion, TEXT_FIELDS_LIST, convertModifiedFields } from "@/lib/version-utils";

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
  const [pdfCacheBust, setPdfCacheBust] = useState<string>("");
  const [sectionPickerOpen, setSectionPickerOpen] = useState(false);

  const canUseAI = profile?.email === "ron@myherocreative.com" || profile?.email === "emili@betterhumanseducation.com" || profile?.email === "tavis.danz@sanjuan.edu";

  const [versions, setVersions] = useState<LessonVersion[]>([]);
  const [activeVersionId, setActiveVersionId] = useState<string | null>(null);
  const [editingVersionId, setEditingVersionId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'original' | 'version'>('original');
  const [showBanner, setShowBanner] = useState(false);
  const [pendingPreview, setPendingPreview] = useState<Record<string, unknown> | null>(null);
  const [lastSavedContent, setLastSavedContent] = useState<Record<string, any> | null>(null);
  const [currentContent, setCurrentContent] = useState<Record<string, any> | null>(null);
  const [showSwitchModal, setShowSwitchModal] = useState(false);
  const [switchTarget, setSwitchTarget] = useState<{ id: string; name: string } | null>(null);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveDialogMode, setSaveDialogMode] = useState<'new' | 'existing'>('new');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const handleSaveVersionRef = useRef<((name: string, reason: string | null, content?: Record<string, { html: string }>) => Promise<void>) | null>(null);
  const pendingAutoCreateContentRef = useRef<Record<string, { html: string }> | null>(null);

  // Trigger for auto-create after handleSaveVersionRequest sets state
  const [autoCreateVersion, setAutoCreateVersion] = useState<{ name: string; preview: Record<string, unknown> } | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [pdfDialogOpen, setPdfDialogOpen] = useState(false);
  const [pdfVersion, setPdfVersion] = useState<LessonVersion | null>(null);
  const [versionsModalOpen, setVersionsModalOpen] = useState(false);
  const [copyingVersionId, setCopyingVersionId] = useState<string | null>(null);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorDetails, setErrorDetails] = useState("");

  const { clearModificationCallback, setVersionCount } = useChatContext();

  const handleSaveVersionRequest = useCallback((preview: Record<string, unknown>, versionId: string | null, suggestedVersionName?: string) => {
    setPendingPreview(preview);
    const previewData = preview as any;

    // Handle multiple formats AI might return:
    // 1. { modifiedFields: { lessonOutline: { html: "..." } } }
    // 2. { modified_fields: { lessonOutline: { html: "..." } } }
    // 3. { lessonOutline: { html: "..." }, welcomeOpening: { html: "..." } } (root level)
    let modifiedFields = previewData.modifiedFields || previewData.modified_fields;
    
    // If no wrapper, check if fields are at root level
    if (!modifiedFields) {
      // Build an object from root-level fields (excluding metadata like summary, suggestedVersionName, etc.)
      modifiedFields = {};
      const knownFieldPatterns = [
        'lessonOutline', 'learningObjectives', 'vocabulary', 'materials',
        'vapaTextBlock', 'ncasTextBlock', 'welcomeOpening', 'actualClassExpectations',
        'warmUp', 'lessonHook', 'mainActivity', 'instrumentExpectations',
        'reflection', 'closingCeremony', 'assessment',
        'outline', 'objectives', 'vocab', 'opening', 'hook', 'activity', 'closing', 'expectations', 'warmup'
      ];
      for (const [key, value] of Object.entries(previewData)) {
        if (knownFieldPatterns.includes(key) && value && typeof value === 'object' && 'html' in value) {
          (modifiedFields as any)[key] = value;
        }
      }
    }

    // Helper to get original lesson content for comparison
    const getOriginalContent = (field: string): string => {
      return (lesson as any)?.[field] || "";
    };

    // Helper to detect placeholder/no content responses
    const isPlaceholder = (html: string): boolean => {
      if (!html) return true;
      const stripped = html.replace(/<[^>]*>/g, '').trim().toLowerCase();
      return stripped === "" ||
             stripped === "no content available" ||
             stripped === "n/a" ||
             stripped.includes("no content");
    };

    if (versionId) {
      setEditingVersionId(versionId);
      setSaveDialogMode('existing');

      const existingVersion = versions.find(v => v.id === versionId);
      const existingContent = existingVersion?.content as Record<string, { html: string }> || {};

      if (modifiedFields && Object.keys(modifiedFields).length > 0) {
        // Start with VERSION content as base
        const content: Record<string, { html: string }> = {};
        for (const field of TEXT_FIELDS_LIST) {
          content[field] = existingContent[field] || { html: "" };
        }

        // Use centralized conversion
        const modified = convertModifiedFields(modifiedFields);

        // Only overlay fields that AI actually modified, aren't placeholder, and aren't copying from original
        for (const field of TEXT_FIELDS_LIST) {
          const newHtml = modified[field]?.html;
          if (!newHtml) continue;

          const existingHtml = existingContent[field]?.html || "";
          const originalHtml = getOriginalContent(field);

          if (isPlaceholder(newHtml)) continue;
          if (existingHtml && newHtml === originalHtml) continue;

          content[field] = { html: newHtml };
        }
        setCurrentContent(content);
        setViewMode('version');
      }
      setShowBanner(true);
    } else {
      setSaveDialogMode('new');

      // Check if this is a duration modification - for duration, we need to use original lesson content as base
      const isDurationModification = previewData?.modificationType === 'duration';

      let contentToUse: Record<string, { html: string }> = {};
      if (modifiedFields && Object.keys(modifiedFields).length > 0) {
        if (isDurationModification) {
          // For duration modifications, build content from original lesson and overlay modified fields
          const originalFields: Record<string, string> = {};
          for (const field of TEXT_FIELDS_LIST) {
            originalFields[field] = getOriginalContent(field);
          }
          // convertModifiedFields will use originalFields as base for unmodified fields
          const converted = convertModifiedFields(modifiedFields, originalFields);
          // Only use AI-modified fields; for unmodified fields, we need to use original content
          // (convertModifiedFields only populates fields from modifiedFields, leaving others empty)
          // So we need to manually build the content with original values for unmodified fields
          contentToUse = {};
          for (const field of TEXT_FIELDS_LIST) {
            const modifiedField = converted[field];
            if (modifiedField?.html) {
              // This field was modified by AI
              contentToUse[field] = modifiedField;
            } else {
              // Use original lesson content for unmodified fields
              contentToUse[field] = { html: originalFields[field] || "" };
            }
          }
        } else {
          // For translation and other modifications, use converted fields (may have empty unmodified fields)
          contentToUse = convertModifiedFields(modifiedFields);
        }
      } else if (isDurationModification) {
        // No modified fields but it's a duration mod - use all original content
        for (const field of TEXT_FIELDS_LIST) {
          contentToUse[field] = { html: getOriginalContent(field) };
        }
      }

      setCurrentContent(contentToUse);
      setViewMode('version');
      setShowBanner(false);

      if (suggestedVersionName) {
        // Use a ref to store content temporarily so it's available when autoCreateVersion effect fires
        pendingAutoCreateContentRef.current = contentToUse;
        setAutoCreateVersion({ name: suggestedVersionName, preview });
      }
    }
  }, []);

  const handleSaveAsRequest = useCallback((preview: Record<string, unknown>) => {
    handleSaveVersionRequest(preview, null);
    setShowBanner(false);
    setShowSaveDialog(true);
  }, [handleSaveVersionRequest]);

  useEffect(() => {
    setVersionCount(versions.length);
  }, [versions.length, setVersionCount]);

  // Persist pendingPreview to localStorage
  useEffect(() => {
    if (pendingPreview && typeof window !== 'undefined') {
      const storageKey = `pendingPreview_${window.location.pathname}`;
      localStorage.setItem(storageKey, JSON.stringify(pendingPreview));
    }
  }, [pendingPreview]);

  // Restore pendingPreview from localStorage on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const storageKey = `pendingPreview_${window.location.pathname}`;
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setPendingPreview(parsed);
        setShowBanner(true);
      } catch {
        localStorage.removeItem(storageKey);
      }
    }
  }, []);

  // Clear editingVersionId when all versions are deleted
  useEffect(() => {
    if (versions.length === 0 && editingVersionId) {
      setEditingVersionId(null);
      setSaveDialogMode('new');
      setShowBanner(false);
      setPendingPreview(null);
    }
  }, [versions.length, editingVersionId]);

  useEffect(() => {
    if (showSaveDialog === false && clearModificationCallback) {
      clearModificationCallback();
    }
  }, [showSaveDialog, clearModificationCallback]);

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
    if (lesson?.id) {
      fetchVersions();
    }
  }, [lesson?.id]);

  const fetchVersions = async () => {
    if (!lesson?.id) return;
    try {
      const res = await fetch(`/api/lessons/${lesson.id}/versions`);
      if (res.ok) {
        const data = await res.json();
        setVersions(data.versions || []);
      }
    } catch (err) {
      console.error("Failed to fetch versions:", err);
    }
  };

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
        .then(data => {
          setPdfExists(data.exists === true);
          setPdfCacheBust(data.generated_at ? new Date(data.generated_at).getTime().toString() : "");
        })
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
    if (showSaveDialog === false && pendingPreview !== null) {
      setPendingPreview(null);
      setShowBanner(false);
      if (typeof window !== 'undefined') {
        localStorage.removeItem(`pendingPreview_${window.location.pathname}`);
      }
    }
  }, [showSaveDialog, pendingPreview]);

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

  // Handle auto-create version when triggered by handleSaveVersionRequest
  useEffect(() => {
    if (autoCreateVersion) {
      const content = pendingAutoCreateContentRef.current;
      handleSaveVersionRef.current?.(autoCreateVersion.name, null, content || undefined);
      pendingAutoCreateContentRef.current = null;
      setAutoCreateVersion(null);
    }
  }, [autoCreateVersion]);

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
    if (viewMode === 'version' && currentContent && currentContent[key]) {
      return (currentContent[key] as { html: string })?.html || "";
    }
    return (lesson as any)[key] || "";
  };

  const renderContent = (content: string) => {
    if (!content || content.trim() === "") return null;
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

  const handleVersionSelect = (version: LessonVersion) => {
    if (hasUnsavedChanges && activeVersionId !== version.id) {
      setSwitchTarget({ id: version.id, name: version.version_name || `Version ${version.version_number}` });
      setShowSwitchModal(true);
      return;
    }
    loadVersion(version);
  };

  const loadVersion = (version: LessonVersion) => {
    const versionContent = version.content as Record<string, { html: string }>;
    const content: Record<string, { html: string }> = {};
    for (const field of TEXT_FIELDS_LIST) {
      if (versionContent[field]?.html) {
        content[field] = { html: versionContent[field].html };
      } else {
        const originalHtml = (lesson as any)[field] || "";
        content[field] = { html: originalHtml };
      }
    }
    setActiveVersionId(version.id);
    setEditingVersionId(version.id);
    setViewMode('version');
    setCurrentContent(content);
    setLastSavedContent(content);
    setHasUnsavedChanges(false);
    setShowBanner(false);
  };

  const handleSaveVersion = async (name: string, reason: string | null, contentOverride?: Record<string, { html: string }> | null) => {
    const contentToSave = contentOverride || currentContent;
    if (!lesson || !contentToSave) return;

    try {
      if (saveDialogMode === 'existing' && editingVersionId) {
        const mergedContent = { ...lastSavedContent, ...contentToSave };
        const res = await fetch(`/api/lessons/${lesson.id}/versions/${editingVersionId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: mergedContent,
            version_name: name,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          const updatedVersion = data.version as LessonVersion;
          setVersions(prev => prev.map(v => v.id === editingVersionId ? updatedVersion : v));
          setShowSaveDialog(false);
          setShowBanner(false);
          setPendingPreview(null);
          setEditingVersionId(null);
          setSuccessMessage(`"${name}" updated successfully!`);
          setShowSuccessModal(true);
          loadVersion(updatedVersion);
        } else {
          const error = await res.json();
          alert(error.error || "Failed to update version");
        }
      } else {
        const res = await fetch(`/api/lessons/${lesson.id}/versions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            version_name: name,
            content: contentToSave,
            modification_reason: reason,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          const newVersion = data.version as LessonVersion;
          setVersions(prev => [...prev, newVersion]);
          setShowSaveDialog(false);
          setShowBanner(false);
          setPendingPreview(null);
          setSuccessMessage(`"${name}" created successfully!`);
          setShowSuccessModal(true);
          loadVersion(newVersion);
        } else {
          const error = await res.json();
          setErrorDetails(error.error || "Failed to save version");
          setShowErrorModal(true);
        }
      }
    } catch (err) {
      console.error("Failed to save version:", err);
      setErrorDetails(err instanceof Error ? err.message : "Unknown error occurred");
      setShowErrorModal(true);
    }
  };

  // Store handleSaveVersion in ref so it can be called from handleSaveVersionRequest
  handleSaveVersionRef.current = handleSaveVersion;

  const handleSave = () => {
    if (!activeVersionId || !currentContent) return;

    const updatedVersions = versions.map(v =>
      v.id === activeVersionId
        ? { ...v, content: currentContent }
        : v
    );
    setVersions(updatedVersions);
    setLastSavedContent(currentContent);
    setHasUnsavedChanges(false);
    setShowBanner(false);

    fetch(`/api/lessons/${lesson?.id}/versions/${activeVersionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: currentContent }),
    }).catch(err => console.error("Failed to update version:", err));
  };

  const handleRevert = () => {
    setCurrentContent(lastSavedContent);
    setHasUnsavedChanges(false);
    setShowBanner(false);
    setPendingPreview(null);
  };

  const handleDeleteVersion = async (versionId: string) => {
    try {
      const res = await fetch(`/api/lessons/${lesson?.id}/versions/${versionId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setVersions(prev => prev.filter(v => v.id !== versionId));
        if (activeVersionId === versionId) {
          setActiveVersionId(null);
          setViewMode('original');
          setCurrentContent(null);
          setLastSavedContent(null);
          setHasUnsavedChanges(false);
          setShowBanner(false);
        }
      }
    } catch (err) {
      console.error("Failed to delete version:", err);
    }
  };

  const handleRenameVersion = async (versionId: string, name: string) => {
    try {
      const res = await fetch(`/api/lessons/${lesson?.id}/versions/${versionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version_name: name }),
      });
      if (res.ok) {
        setVersions(prev =>
          prev.map(v => v.id === versionId ? { ...v, version_name: name } : v)
        );
      }
    } catch (err) {
      console.error("Failed to rename version:", err);
    }
  };

  const handleCopyToNew = async (versionId: string) => {
    const sourceVersion = versions.find(v => v.id === versionId);
    if (!sourceVersion || !lesson) return;

    try {
      const res = await fetch(`/api/lessons/${lesson.id}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: sourceVersion.content,
          copyFromVersionId: versionId,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const newVersion = data.version as LessonVersion;
        setVersions(prev => [...prev, newVersion]);
        setSuccessMessage(`"${newVersion.version_name}" created as a copy!`);
        setShowSuccessModal(true);
      } else {
        const error = await res.json();
        alert(error.error || "Failed to copy version");
      }
    } catch (err) {
      console.error("Failed to copy version:", err);
      alert("Failed to copy version");
    }
  };

  const handleGeneratePdf = (versionId: string) => {
    const version = versions.find(v => v.id === versionId);
    if (version) {
      setPdfVersion(version);
      setPdfDialogOpen(true);
    }
  };

  const handleGeneratePdfConfirm = async (versionId: string) => {
    try {
      const res = await fetch(`/api/lessons/${lesson?.id}/versions/${versionId}/pdf`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed to generate PDF");
      } else {
        const data = await res.json();
        setVersions(prev =>
          prev.map(v =>
            v.id === versionId
              ? { ...v, pdf_storage_path: data.filename, pdf_generated_at: data.generated_at }
              : v
          )
        );
        if (data.filename) {
          window.open(`/api/lessons/${lesson?.id}/versions/${versionId}/pdf`, "_blank");
        }
      }
    } catch (err) {
      console.error("Failed to generate PDF:", err);
      alert("Failed to generate PDF");
    }
  };

  const handleViewPdf = (versionId: string) => {
    window.open(`/api/lessons/${lesson?.id}/versions/${versionId}/pdf?cb=${Date.now()}`, "_blank");
  };

  const handleSwitchVersion = (action: 'save' | 'discard' | 'cancel') => {
    if (action === 'save' && activeVersionId) {
      handleSave();
    }

    if (action !== 'cancel' && switchTarget) {
      const targetVersion = versions.find(v => v.id === switchTarget.id);
      if (targetVersion) {
        if (action === 'discard') {
          setHasUnsavedChanges(false);
          setCurrentContent(null);
        }
        loadVersion(targetVersion);
      }
    }

    setShowSwitchModal(false);
    setSwitchTarget(null);
  };

  return (
    <div className="min-h-screen bg-white">
      {lesson && course && (
        <SetChatContext
          lessonId={lesson.id}
          courseId={course.id}
          editingVersionId={editingVersionId}
          onSaveVersionRequest={canUseAI ? handleSaveVersionRequest : undefined}
          onSaveAsRequest={canUseAI ? handleSaveAsRequest : undefined}
        />
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
                          href={`/api/lessons/${lesson.id}/pdf?download=false&t=${pdfCacheBust}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#0d7377] hover:underline"
                          onClick={(e) => handlePdfClick(e, false)}
                        >
                          View PDF
                        </a>
                        {" | "}
                        <a
                          href={`/api/lessons/${lesson.id}/pdf?download=true&t=${pdfCacheBust}`}
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

            {canUseAI && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <button
                  onClick={() => setVersionsModalOpen(true)}
                  className="w-full px-3 py-2 bg-[#0d7377] text-white text-xs font-medium rounded hover:bg-[#0a5c5f]"
                >
                  Versions ({versions.length})
                </button>
              </div>
            )}

            {canUseAI && showBanner && (
              <div className="mt-4 p-3 bg-[#e37c64] rounded-lg flex justify-center">
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      if (editingVersionId) {
                        // Update existing version
                        const existingVersion = versions.find(v => v.id === editingVersionId);
                        handleSaveVersion(existingVersion?.version_name || "Untitled Version", null);
                      } else {
                        // Create new version with default name
                        const defaultName = `Translation - ${new Date().toLocaleDateString()}`;
                        handleSaveVersion(defaultName, null);
                      }
                      if (typeof window !== 'undefined') {
                        localStorage.removeItem(`pendingPreview_${window.location.pathname}`);
                      }
                    }}
                    className="px-3 h-8 min-w-[80px] bg-[#0d7377] text-white text-xs font-medium rounded hover:bg-[#0a5c5f]"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => {
                      const originalVersion = versions.find(v => v.id === editingVersionId);
                      if (originalVersion) {
                        loadVersion(originalVersion);
                      }
                      setPendingPreview(null);
                      setShowBanner(false);
                      setEditingVersionId(null);
                      if (typeof window !== 'undefined') {
                        localStorage.removeItem(`pendingPreview_${window.location.pathname}`);
                      }
                    }}
                    className="px-3 h-8 min-w-[80px] bg-gray-200 text-gray-700 text-xs font-medium rounded hover:bg-gray-300"
                  >
                    Reject
                  </button>
                </div>
              </div>
            )}

            {canUseAI && (
              <div className="mt-4 pt-4 border-t border-gray-200 space-y-1">
                <span className="text-xs font-medium text-gray-500">View:</span>
                <button
                  onClick={() => {
                    setViewMode('original');
                    setActiveVersionId(null);
                    setEditingVersionId(null);
                    setCurrentContent(null);
                    setHasUnsavedChanges(false);
                    setShowBanner(false);
                  }}
                  className={`block w-full text-left px-2 py-1 text-xs rounded ${
                    viewMode === 'original' ? 'bg-[#0d7377] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Original
                </button>
                {activeVersionId && versions.find(v => v.id === activeVersionId) && (
                  <button
                    onClick={() => setViewMode('version')}
                    className={`block w-full text-left px-2 py-1 text-xs rounded ${
                      viewMode === 'version' ? 'bg-[#0d7377] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {versions.find(v => v.id === activeVersionId)?.version_name || 'Version'}
                  </button>
                )}
              </div>
            )}
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

      <Dialog open={showSwitchModal} onOpenChange={setShowSwitchModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Unsaved Changes</DialogTitle>
            <DialogDescription>
              You have unsaved changes on &quot;{switchTarget?.name}&quot;.
              What would you like to do?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => handleSwitchVersion('cancel')}>
              Cancel
            </Button>
            <Button variant="outline" onClick={() => handleSwitchVersion('discard')}>
              Discard
            </Button>
            <Button onClick={() => handleSwitchVersion('save')}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SaveVersionDialog
        open={showSaveDialog}
        onOpenChange={setShowSaveDialog}
        onSave={handleSaveVersion}
      />

      {pdfVersion && (
        <GeneratePdfDialog
          open={pdfDialogOpen}
          onOpenChange={(open) => {
            setPdfDialogOpen(open);
            if (!open) setPdfVersion(null);
          }}
          lessonId={lesson.id}
          version={pdfVersion}
          onPdfGenerated={(filename) => {
            setVersions(prev =>
              prev.map(v =>
                v.id === pdfVersion.id
                  ? { ...v, pdf_storage_path: filename, pdf_generated_at: new Date().toISOString() }
                  : v
              )
            );
          }}
        />
      )}

      <Dialog open={showSuccessModal} onOpenChange={setShowSuccessModal}>
        <DialogContent className="w-[90%] md:w-[50%] md:max-w-[50%]">
          <DialogHeader>
            <DialogTitle>Success</DialogTitle>
            <DialogDescription>{successMessage}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setShowSuccessModal(false)}>OK</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showErrorModal} onOpenChange={setShowErrorModal}>
        <DialogContent className="w-[90%] md:w-[50%] md:max-w-[50%]">
          <DialogHeader>
            <DialogTitle>Failed to Save Version</DialogTitle>
            <DialogDescription>
              The lesson content was modified but the version couldn&apos;t be saved.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 p-3 bg-muted rounded-md text-sm">
            <p className="font-medium text-destructive mb-1">Error Details:</p>
            <p className="text-muted-foreground whitespace-pre-wrap">{errorDetails}</p>
          </div>
          <DialogFooter className="flex-row gap-2 sm:gap-2">
            <Button
              variant="outline"
              onClick={() => {
                navigator.clipboard.writeText(errorDetails);
              }}
            >
              Copy Error Details
            </Button>
            <Button onClick={() => setShowErrorModal(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <VersionsModal
        open={versionsModalOpen}
        onOpenChange={setVersionsModalOpen}
        versions={versions}
        activeVersionId={activeVersionId}
        onSelect={handleVersionSelect}
        onDelete={handleDeleteVersion}
        onRename={handleRenameVersion}
        onCopyToNew={handleCopyToNew}
        onGeneratePdf={handleGeneratePdf}
        onViewPdf={handleViewPdf}
      />
    </div>
  );
}
