"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { LessonEditor } from "@/components/editor/lesson-editor";
import { LessonAssetsPanel } from "@/components/lesson-assets-panel";
import { FindReplacePanel } from "@/components/find-replace-panel";
import { LessonNavigation } from "@/components/lesson-navigation";
import { PresentationModal, PresentationLink } from "@/components/presentation-modal";
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
  presentation_name: string | null;
  presentation_url: string | null;
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
  { name: "warm_up", label: "Warm Up" },
  { name: "lesson_hook", label: 'Lesson "Hook"' },
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
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [saved, setSaved] = useState(false);
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [course, setCourse] = useState<{ title: string; discipline: string; grade: string; image_url: string | null } | null>(null);

  const [showPresentationModal, setShowPresentationModal] = useState(false);
  const [presentationName, setPresentationName] = useState("");
  const [presentationUrl, setPresentationUrl] = useState("");
  const [selectedSection, setSelectedSection] = useState(textFields[0].name);
  const editorSectionRef = useRef<HTMLDivElement>(null);
  const [activePanel, setActivePanel] = useState<'general' | 'materials' | 'section' | 'pdf'>('general');
  const [pdfInfo, setPdfInfo] = useState<{
    exists: boolean;
    generated_at?: string;
    file_size?: number;
    filename?: string;
  } | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
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
        setPresentationName(lessonData.presentation_name || "");
        setPresentationUrl(lessonData.presentation_url || "");

        const sectionParam = searchParams.get("section");
        if (sectionParam && textFields.some(f => f.name === sectionParam)) {
          setSelectedSection(sectionParam);
          setActivePanel('section');
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setFetching(false);
      }
    });
  }, []);

  useEffect(() => {
    if (lesson?.id) {
      fetch(`/api/lessons/${lesson.id}/pdf/info`)
        .then((res) => res.json())
        .then((data) => setPdfInfo(data))
        .catch(() => setPdfInfo({ exists: false }));
    }
  }, [lesson?.id]);

  const handleGeneratePDF = async () => {
    if (!lesson) return;
    setPdfLoading(true);
    setPdfError(null);

    try {
      const res = await fetch(`/api/lessons/${lesson.id}/pdf/generate`, {
        method: 'POST',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to generate PDF');
      }

      const data = await res.json();
      setPdfInfo({
        exists: true,
        generated_at: data.generated_at,
        file_size: data.file_size,
        filename: data.filename,
      });
    } catch (err: any) {
      setPdfError(err.message);
    } finally {
      setPdfLoading(false);
    }
  };

  useEffect(() => {
    setTimeout(() => {
      if (editorSectionRef.current) {
        editorSectionRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 150);
  }, [selectedSection]);

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

      setSaved(true);
      setLoading(false);
      setTimeout(() => setSaved(false), 3000);
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

  const handleSavePresentation = async (name: string, url: string) => {
    if (!lesson) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/lessons/${lesson.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ presentation_name: name, presentation_url: url }),
      });
      if (!res.ok) throw new Error("Failed to save");
      setPresentationName(name);
      setPresentationUrl(url);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRemovePresentation = async () => {
    if (!lesson) return;
    if (!confirm("Remove presentation link?")) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/lessons/${lesson.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ presentation_name: null, presentation_url: null }),
      });
      if (!res.ok) throw new Error("Failed to remove");
      setPresentationName("");
      setPresentationUrl("");
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
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
    <div className="min-h-screen bg-white">
      <div className="sticky top-0 z-50 bg-white border-b border-[#e5e5e0] shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-4">
              <Link
                href={`/admin/courses/${lesson?.course_id}`}
                className="text-sm text-[#0d7377] hover:underline"
              >
                ← Back to Course
              </Link>
              <span className="text-gray-300">|</span>
              <Link
                href={`/lessons/${lesson?.id}`}
                target="_blank"
                className="text-sm text-[#0d7377] hover:underline"
              >
                View Lesson ↗
              </Link>
            </div>
            <div className="flex items-center gap-3">
              <LessonNavigation
                courseId={lesson?.course_id}
                currentLessonId={lesson?.id}
                admin={true}
              />
              <Button
                type="button"
                onClick={() => handleSubmit({ preventDefault: () => {} } as React.FormEvent)}
                disabled={loading}
                className="bg-[#0d7377] hover:bg-[#0a5c5f] text-white"
              >
                {loading ? "Saving..." : saved ? "Saved!" : "Save"}
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
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                Delete
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex gap-6">
          {/* Left Navigation - Sticky */}
          <div className="w-[280px] flex-shrink-0 sticky top-14 self-start">
            {/* Teal header buttons */}
            <div className="space-y-1 mb-2">
              <button
                type="button"
                onClick={() => setActivePanel('general')}
                className={`w-full text-left px-2 py-1.5 text-xs font-medium transition-colors truncate ${
                  activePanel === 'general'
                    ? "bg-[#0d7377] text-white"
                    : "bg-[#e85d5d] text-white"
                }`}
              >
                General Info
              </button>
              <button
                type="button"
                onClick={() => setActivePanel('materials')}
                className={`w-full text-left px-2 py-1.5 text-xs font-medium transition-colors truncate ${
                  activePanel === 'materials'
                    ? "bg-[#0d7377] text-white"
                    : "bg-[#e85d5d] text-white"
                }`}
              >
                Lesson Materials
              </button>
              <button
                type="button"
                onClick={() => setActivePanel('pdf')}
                className={`w-full text-left px-2 py-1.5 text-xs font-medium transition-colors truncate ${
                  activePanel === 'pdf'
                    ? "bg-[#0d7377] text-white"
                    : "bg-[#e85d5d] text-white"
                }`}
              >
                PDF
              </button>
            </div>
            <div className="w-full h-px bg-[#e5e5e0] my-2" />
            {/* Section buttons */}
            <div className="space-y-1">
              {textFields.map((field) => (
                <button
                  key={field.name}
                  type="button"
                  onClick={() => { setActivePanel('section'); setSelectedSection(field.name); }}
                  className={`w-full text-left px-2 py-1.5 text-xs font-medium transition-colors truncate ${
                    activePanel === 'section' && selectedSection === field.name
                      ? "bg-[#0d7377] text-white"
                      : "bg-[#d7ffef] text-black hover:bg-[#c7efe0]"
                  }`}
                >
                  {field.label}
                </button>
              ))}
            </div>
          </div>

          {/* Right Content - Based on activePanel */}
          <div className="flex-1">
            {/* General Info Panel */}
            {activePanel === 'general' && (
              <div className="bg-white rounded-lg border border-[#e5e5e0] p-4 space-y-4">
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
                  className="border-[#e5e5e0] focus:border-[#0d7377] max-w-xs"
                />
              </div>
            </div>
          )}

            {/* Materials Panel */}
            {activePanel === 'materials' && (
              <div className="bg-white rounded-lg border border-[#e5e5e0] p-4 space-y-4">
                <LessonAssetsPanel lessonId={lesson.id} canEdit={true} />
                <div className="flex gap-4 pt-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowPresentationModal(true)}
                    className="border-[#e5e5e0]"
                  >
                    Add Presentation
                  </Button>
                </div>
                {presentationName && (
                  <div className="flex items-center gap-3 py-2 px-3 bg-gray-50 rounded-lg">
                    <PresentationLink name={presentationName} url={presentationUrl} />
                    <button type="button" onClick={() => setShowPresentationModal(true)} className="text-xs text-[#0d7377] hover:underline">Edit</button>
                    <button type="button" onClick={handleRemovePresentation} className="text-xs text-red-600 hover:underline">Remove</button>
                  </div>
                )}
              </div>
            )}

            {/* PDF Panel */}
            {activePanel === 'pdf' && (
              <div className="bg-white rounded-lg border border-[#e5e5e0] p-4 space-y-4">
                <h3 className="text-lg font-semibold text-[#2d2d2d]">PDF Generation</h3>
                {pdfLoading ? (
                  <div className="text-center py-8">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-[#0d7377] border-t-transparent"></div>
                    <p className="mt-4 text-gray-600">Generating PDF...</p>
                  </div>
                ) : pdfInfo?.exists ? (
                  <div className="space-y-4">
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-sm text-gray-600">
                        <strong>Current PDF:</strong> {pdfInfo.filename}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Generated: {pdfInfo.generated_at && new Date(pdfInfo.generated_at).toLocaleString()}
                        {pdfInfo.file_size && ` • ${(pdfInfo.file_size / 1024).toFixed(1)} KB`}
                      </p>
                    </div>
                    <div className="flex gap-4">
                      <a
                        href={`/api/lessons/${lesson.id}/pdf?download=false`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2 bg-white border border-[#0d7377] text-[#0d7377] rounded hover:bg-[#0d7377] hover:text-white transition-colors"
                      >
                        View PDF
                      </a>
                      <a
                        href={`/api/lessons/${lesson.id}/pdf?download=true`}
                        className="px-4 py-2 bg-white border border-[#0d7377] text-[#0d7377] rounded hover:bg-[#0d7377] hover:text-white transition-colors"
                      >
                        Download PDF
                      </a>
                    </div>
                    <div className="pt-4 border-t">
                      <button
                        onClick={handleGeneratePDF}
                        className="px-4 py-2 bg-[#0d7377] text-white rounded hover:bg-[#0a5c5f] transition-colors"
                      >
                        Generate New PDF
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-gray-500 mb-4">No PDF has been generated yet</p>
                    <button
                      onClick={handleGeneratePDF}
                      className="px-4 py-2 bg-[#0d7377] text-white rounded hover:bg-[#0a5c5f] transition-colors"
                    >
                      Generate PDF
                    </button>
                  </div>
                )}
                {pdfError && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 mt-4">
                    <p className="text-sm text-red-600"><strong>Error:</strong> {pdfError}</p>
                    <button
                      onClick={() => setPdfError(null)}
                      className="mt-2 text-xs text-red-600 hover:underline"
                    >
                      Dismiss
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Section Editor Panel */}
            {activePanel === 'section' && (
              <div className="bg-white rounded-lg border border-[#e5e5e0] p-4">
                <FindReplacePanel
                  lessonId={lesson.id}
                  courseId={lesson.course_id}
                  isAdmin={true}
                />
                <div className="space-y-2">
                  <Label className="text-[#2d2d2d] font-bold text-base">
                    {textFields.find(f => f.name === selectedSection)?.label}
                  </Label>
                  <LessonEditor
                    key={selectedSection}
                    content={fields[selectedSection as keyof Fields]}
                    onChange={(content) => handleFieldChange(selectedSection, content)}
                    placeholder={`Enter ${textFields.find(f => f.name === selectedSection)?.label.toLowerCase()}...`}
                    lessonId={lesson.id}
                    courseId={lesson.course_id}
                    isAdmin={true}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <PresentationModal
        open={showPresentationModal}
        onClose={() => setShowPresentationModal(false)}
        lessonId={lesson.id}
        existingName={presentationName}
        existingUrl={presentationUrl}
        onSave={handleSavePresentation}
      />
    </div>
  );
}