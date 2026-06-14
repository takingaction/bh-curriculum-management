"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams, usePathname } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { LessonEditor } from "@/components/editor/lesson-editor";
import { ChevronLeft, ChevronRight, Save, AlertCircle } from "lucide-react";

interface Lesson {
  id: string;
  course_id: string;
  lesson_number: number;
  title: string;
  [key: string]: any;
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

export default function SectionEditPage() {
  const router = useRouter();
  const params = useParams();
  const pathname = usePathname();
  
  const courseId = params.id as string;
  const lessonId = params.lessonId as string;
  const sectionKey = params.sectionKey as string;
  
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [content, setContent] = useState("");
  const [originalContent, setOriginalContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  const currentIndex = textFields.findIndex(f => f.name === sectionKey);
  const currentField = textFields[currentIndex];
  const prevField = currentIndex > 0 ? textFields[currentIndex - 1] : null;
  const nextField = currentIndex < textFields.length - 1 ? textFields[currentIndex + 1] : null;
  
  useEffect(() => {
    const fetchLesson = async () => {
      try {
        const res = await fetch(`/api/lessons/${lessonId}`);
        if (!res.ok) throw new Error("Failed to fetch lesson");
        const data = await res.json();
        setLesson(data.lesson);
        const sectionContent = data.lesson[sectionKey] || "";
        setContent(sectionContent);
        setOriginalContent(sectionContent);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    
    fetchLesson();
  }, [lessonId, sectionKey]);
  
  const handleSave = useCallback(async () => {
    if (!lesson || !hasUnsavedChanges) return;
    
    setSaving(true);
    setError("");
    
    try {
      const res = await fetch(`/api/admin/lessons/${lesson.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [sectionKey]: content }),
      });
      
      if (!res.ok) throw new Error("Failed to save");
      
      setOriginalContent(content);
      setHasUnsavedChanges(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }, [lesson, content, sectionKey, hasUnsavedChanges]);
  
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);
  
  useEffect(() => {
    const handleNavClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const anchor = target.closest("a");
      if (!anchor) return;
      
      const href = anchor.getAttribute("href");
      if (!href) return;
      
      if (hasUnsavedChanges && !window.confirm("You have unsaved changes. Are you sure you want to leave?")) {
        e.preventDefault();
      }
    };
    
    document.addEventListener("click", handleNavClick);
    return () => document.removeEventListener("click", handleNavClick);
  }, [hasUnsavedChanges]);
  
  const handleContentChange = (newContent: string) => {
    setContent(newContent);
    setHasUnsavedChanges(newContent !== originalContent);
  };
  
  const handleNavigate = (field: typeof nextField) => {
    if (!field) return;
    if (hasUnsavedChanges) {
      handleSave();
    }
    router.push(`/admin/courses/${courseId}/lessons/${lessonId}/section/${field.name}`);
  };
  
  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-[#f5f5f0] rounded w-1/3" />
          <div className="h-64 bg-[#f5f5f0] rounded" />
        </div>
      </div>
    );
  }
  
  if (!lesson || !currentField) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-[#e85d5d]">Section not found</p>
          <Button variant="outline" onClick={() => router.back()} className="mt-4">
            Go Back
          </Button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <div className="sticky top-0 z-50 bg-white border-b border-[#e5e5e0] shadow-sm w-full">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-4">
              <Link 
                href={`/admin/courses/${courseId}/lessons/${lessonId}`}
                className="text-sm text-[#0d7377] hover:underline"
              >
                ← Back to Edit
              </Link>
              <span className="text-gray-300">|</span>
              <span className="text-sm text-gray-600">
                {currentIndex + 1} of {textFields.length}
              </span>
            </div>
            
            <div className="flex items-center gap-4">
              {error && (
                <span className="text-sm text-[#e85d5d] flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" />
                  {error}
                </span>
              )}
              
              {saved && (
                <span className="text-sm text-green-600">Saved!</span>
              )}
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleNavigate(prevField)}
                disabled={!prevField}
                className="border-[#e5e5e0]"
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Previous
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleNavigate(nextField)}
                disabled={!nextField}
                className="border-[#e5e5e0]"
              >
                Next
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
              
              <Button
                size="sm"
                onClick={handleSave}
                disabled={saving || !hasUnsavedChanges}
                className="bg-[#0d7377] hover:bg-[#0a5c5f] text-white"
              >
                <Save className="w-4 h-4 mr-1" />
                {saving ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </div>
      </div>
      
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="mb-4">
          <h1 className="text-xl font-bold text-[#2d2d2d]">{lesson.title}</h1>
          <p className="text-sm text-gray-500">Lesson #{lesson.lesson_number}</p>
        </div>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-[#2d2d2d]">
              {currentField.label}
            </h2>
            {hasUnsavedChanges && (
              <span className="text-xs text-orange-500 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                Unsaved changes
              </span>
            )}
          </div>
          
          <LessonEditor
            content={content}
            onChange={handleContentChange}
            placeholder={`Enter ${currentField.label.toLowerCase()}...`}
            lessonId={lesson.id}
            courseId={lesson.course_id}
            isAdmin={true}
          />
        </div>
        
        <div className="mt-8 pt-6 border-t border-[#e5e5e0]">
          <div className="flex items-center justify-between text-sm text-gray-500">
            <span>
              Section {currentIndex + 1} of {textFields.length}
            </span>
            <div className="flex gap-4">
              {prevField && (
                <button
                  onClick={() => handleNavigate(prevField)}
                  className="hover:text-[#0d7377] hover:underline"
                >
                  ← {prevField.label}
                </button>
              )}
              {nextField && (
                <button
                  onClick={() => handleNavigate(nextField)}
                  className="hover:text-[#0d7377] hover:underline"
                >
                  {nextField.label} →
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}