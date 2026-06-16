"use client";

import { useState, useEffect } from "react";
import { Search, X, ChevronDown, ChevronUp, RefreshCw } from "lucide-react";

interface Course {
  id: string;
  title: string;
  discipline: string;
  grade: string;
}

interface Match {
  lessonId: string;
  lessonNumber: number;
  lessonTitle: string;
  courseId: string;
  courseName: string;
  fieldName: string;
  fieldLabel: string;
  snippet: string;
  count: number;
}

interface FindReplacePanelProps {
  lessonId?: string;
  courseId?: string;
  isAdmin?: boolean;
}

export function FindReplacePanel({ lessonId, courseId, isAdmin = false }: FindReplacePanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [scope, setScope] = useState<"lesson" | "course" | "global">("lesson");
  const [selectedCourseId, setSelectedCourseId] = useState<string>(courseId || "");
  const [courses, setCourses] = useState<Course[]>([]);
  const [searchText, setSearchText] = useState("");
  const [replaceText, setReplaceText] = useState("");
  const [matches, setMatches] = useState<Match[]>([]);
  const [totalMatches, setTotalMatches] = useState(0);
  const [totalLessons, setTotalLessons] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const [isReplacing, setIsReplacing] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    if (isOpen && scope === "global" && courses.length === 0) {
      fetchCourses();
    }
  }, [isOpen, scope]);

  useEffect(() => {
    if (scope === "course" && courseId && courses.length === 0) {
      fetchCourses();
    }
  }, [scope, courseId]);

  const fetchCourses = async () => {
    try {
      const res = await fetch("/api/admin/courses");
      if (res.ok) {
        const data = await res.json();
        setCourses(data.courses || []);
      }
    } catch (err) {
      console.error("Failed to fetch courses:", err);
    }
  };

  const handleSearch = async () => {
    if (!searchText.trim()) return;

    setIsSearching(true);
    try {
      const params = new URLSearchParams({
        search: searchText,
        scope,
      });

      if (scope === "lesson" && lessonId) {
        params.append("lessonId", lessonId);
      } else if (scope === "course" && selectedCourseId) {
        params.append("courseId", selectedCourseId);
      }

      const res = await fetch(`/api/find-replace?${params}`);
      const data = await res.json();

      if (res.ok) {
        setMatches(data.matches || []);
        setTotalMatches(data.totalMatches || 0);
        setTotalLessons(data.totalLessons || 0);
      } else {
        console.error("Search failed:", data.error);
      }
    } catch (err) {
      console.error("Search error:", err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleReplace = async () => {
    if (!searchText.trim() || totalMatches === 0) return;

    setIsReplacing(true);
    try {
      const body: any = {
        search: searchText,
        replace: replaceText,
        scope,
      };

      if (scope === "lesson" && lessonId) {
        body.lessonId = lessonId;
      } else if (scope === "course" && selectedCourseId) {
        body.courseId = selectedCourseId;
      }

      const res = await fetch("/api/find-replace", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (res.ok) {
        setTotalMatches(0);
        setMatches([]);
        setSearchText("");
        setReplaceText("");
        alert(`Replaced ${data.updatedCount} instances across ${data.lessonsUpdated} lessons.`);
        window.location.reload();
      } else {
        console.error("Replace failed:", data.error);
      }
    } catch (err) {
      console.error("Replace error:", err);
    } finally {
      setIsReplacing(false);
      setShowConfirm(false);
    }
  };

  const handleReplaceOne = async (match: Match) => {
    if (!searchText.trim()) return;

    setIsReplacing(true);
    try {
      const res = await fetch(`/api/find-replace`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          search: searchText,
          replace: replaceText,
          scope: "lesson",
          lessonId: match.lessonId,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setTotalMatches(prev => prev - match.count);
        setMatches(prev => prev.filter(m => !(m.lessonId === match.lessonId && m.fieldName === match.fieldName)));
        if (replaceText) {
          window.location.reload();
        }
      }
    } catch (err) {
      console.error("Replace error:", err);
    } finally {
      setIsReplacing(false);
    }
  };

  if (!isAdmin) return null;

  return (
    <div className="bg-white border border-[#e5e5e0] rounded-lg mb-4">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Search className="w-4 h-4 text-[#0d7377]" />
          <span className="font-medium text-sm">Find & Replace</span>
        </div>
        {isOpen ? (
          <ChevronUp className="w-4 h-4 text-gray-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-400" />
        )}
      </button>

      {isOpen && (
        <div className="px-4 pb-4 border-t border-[#e5e5e0] pt-4">
          <div className="space-y-4">
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <input
                  type="radio"
                  id="scope-lesson"
                  checked={scope === "lesson"}
                  onChange={() => setScope("lesson")}
                  className="w-4 h-4"
                />
                <label htmlFor="scope-lesson" className="text-sm">Lesson</label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="radio"
                  id="scope-course"
                  checked={scope === "course"}
                  onChange={() => setScope("course")}
                  className="w-4 h-4"
                />
                <label htmlFor="scope-course" className="text-sm">Course</label>
                {scope === "course" && (
                  <select
                    value={selectedCourseId}
                    onChange={(e) => setSelectedCourseId(e.target.value)}
                    className="px-2 py-1 border border-gray-300 rounded text-sm ml-2"
                  >
                    <option value="">All Courses</option>
                    {courses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="radio"
                  id="scope-global"
                  checked={scope === "global"}
                  onChange={() => setScope("global")}
                  className="w-4 h-4"
                />
                <label htmlFor="scope-global" className="text-sm">Global</label>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-1">
                <label className="text-xs text-gray-500 mb-1 block">Find</label>
                <input
                  type="text"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  placeholder="Text to find..."
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSearch();
                    }
                  }}
                />
              </div>
              <div className="flex-1">
                <label className="text-xs text-gray-500 mb-1 block">Replace</label>
                <input
                  type="text"
                  value={replaceText}
                  onChange={(e) => setReplaceText(e.target.value)}
                  placeholder="Replacement text..."
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSearch();
                    }
                  }}
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleSearch}
                disabled={isSearching || !searchText.trim()}
                className="flex items-center gap-1 px-4 py-2 bg-[#0d7377] text-white rounded text-sm hover:bg-[#0a5c5f] disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {isSearching ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
                Search
              </button>
            </div>

            {totalMatches > 0 && (
              <div className="border-t border-gray-200 pt-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-medium">
                    Found {totalMatches} match{totalMatches !== 1 ? "es" : ""} in {totalLessons} lesson{totalLessons !== 1 ? "s" : ""}
                  </p>
                  {replaceText && (
                    <button
                      type="button"
                      onClick={() => setShowConfirm(true)}
                      disabled={isReplacing}
                      className="px-4 py-2 bg-[#e85d5d] text-white rounded text-sm hover:bg-red-600 disabled:bg-gray-300"
                    >
                      Replace All
                    </button>
                  )}
                </div>

                <div className="max-h-60 overflow-y-auto space-y-2">
                  {matches.map((match, idx) => (
                    <div
                      key={`${match.lessonId}-${match.fieldName}-${idx}`}
                      className="p-3 bg-gray-50 rounded border border-gray-200"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div>
                          <span className="text-xs font-medium text-[#0d7377]">
                            Lesson {match.lessonNumber}
                          </span>
                          <span className="text-xs text-gray-500 mx-2">-</span>
                          <span className="text-xs font-medium">{match.fieldLabel}</span>
                        </div>
                        {replaceText && (
                          <button
                            type="button"
                            onClick={() => handleReplaceOne(match)}
                            disabled={isReplacing}
                            className="text-xs px-2 py-1 bg-white border border-[#0d7377] text-[#0d7377] rounded hover:bg-[#d7ffef] disabled:bg-gray-100"
                          >
                            Replace
                          </button>
                        )}
                      </div>
                      <p
                        className="text-sm text-gray-600"
                        dangerouslySetInnerHTML={{ __html: match.snippet }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {searchText && totalMatches === 0 && !isSearching && (
              <p className="text-sm text-gray-500">No matches found.</p>
            )}
          </div>
        </div>
      )}

      {showConfirm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 max-w-sm mx-4">
            <h3 className="text-lg font-medium mb-2">Confirm Replace All</h3>
            <p className="text-sm text-gray-600 mb-4">
              This will replace {totalMatches} instance{totalMatches !== 1 ? "s" : ""} across{" "}
              {totalLessons} lesson{totalLessons !== 1 ? "s" : ""}. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                className="px-4 py-2 border border-gray-300 rounded text-sm hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReplace}
                disabled={isReplacing}
                className="px-4 py-2 bg-[#e85d5d] text-white rounded text-sm hover:bg-red-600 disabled:bg-gray-300"
              >
                {isReplacing ? "Replacing..." : "Replace All"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
