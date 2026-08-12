"use client";

import { useState, useRef, useEffect } from "react";
import { useChatContext } from "./chat-context";

interface SearchResult {
  lesson_id: string;
  field_name: string;
  chunk_text: string;
  similarity: number;
  lesson_number?: number;
  lesson_title?: string;
  course_title?: string;
  course_id?: string;
  grade?: string;
}

type SearchScope = "lesson" | "course" | "global";

const SEARCH_STORAGE_KEY = 'aiSearchHistory';

export function SearchChatWidget() {
  const { lessonId, courseId } = useChatContext();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [totalResults, setTotalResults] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [activeScope, setActiveScope] = useState<SearchScope>(() => {
    if (lessonId) return "lesson";
    if (courseId) return "course";
    return "global";
  });
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (lessonId) {
      setActiveScope("lesson");
    } else if (courseId) {
      setActiveScope("course");
    } else {
      setActiveScope("global");
    }
  }, [lessonId, courseId]);

  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  const handleSearch = async (pageNum: number = 0) => {
    if (!query || query.length < 2) return;

    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        q: query,
        scope: activeScope,
        page: pageNum.toString(),
        pageSize: "10",
      });
      if (activeScope === "lesson" && lessonId) params.set("lessonId", lessonId);
      if (activeScope === "course" && courseId) params.set("courseId", courseId);

      const response = await fetch(`/api/search?${params}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Search failed");
      }

      if (pageNum === 0) {
        setResults(data.results || []);
      } else {
        setResults(prev => [...prev, ...(data.results || [])]);
      }
      setTotalResults(data.totalResults || 0);
      setHasMore(data.hasMore || false);
      setPage(pageNum);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSearch(0);
    }
  };

  const loadMore = () => {
    if (hasMore && !isLoading) {
      handleSearch(page + 1);
    }
  };

  const getFieldLabel = (fieldName: string): string => {
    const labels: Record<string, string> = {
      lesson_outline: "Lesson Outline",
      learning_objectives: "Learning Objectives",
      vocabulary: "Vocabulary",
      materials: "Materials",
      vapa_text_block: "VAPA Standards",
      ncas_text_block: "NCAS Standards",
      welcome_opening: "Welcome & Opening",
      actual_class_expectations: "Class Expectations",
      warm_up: "Warm Up",
      lesson_hook: "Lesson Hook",
      main_activity: "Main Activity",
      instrument_expectations: "Instrument Expectations",
      reflection: "Reflection",
      closing_ceremony: "Closing Ceremony",
      assessment: "Assessment",
    };
    return labels[fieldName] || fieldName;
  };

  const isScopeDisabled = (scope: SearchScope) => {
    if (scope === "lesson" && !lessonId) return true;
    if (scope === "course" && !courseId) return true;
    return false;
  };

  const getScopeLabel = (scope: SearchScope) => {
    if (scope === "lesson") return lessonId ? "This Lesson" : "Lesson (no lesson open)";
    if (scope === "course") return courseId ? "This Course" : "Course (no course selected)";
    return "All Courses";
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-gray-200 space-y-3">
        <div className="flex gap-1 p-1 bg-gray-100 rounded-md">
          <button
            onClick={() => setActiveScope("lesson")}
            disabled={isScopeDisabled("lesson")}
            className={`flex-1 px-3 py-1.5 text-xs font-medium rounded transition-colors ${
              activeScope === "lesson"
                ? "bg-[#0d7377] text-white"
                : isScopeDisabled("lesson")
                  ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                  : "bg-white text-gray-700 hover:bg-gray-50"
            }`}
          >
            {getScopeLabel("lesson")}
          </button>
          <button
            onClick={() => setActiveScope("course")}
            disabled={isScopeDisabled("course")}
            className={`flex-1 px-3 py-1.5 text-xs font-medium rounded transition-colors ${
              activeScope === "course"
                ? "bg-[#0d7377] text-white"
                : isScopeDisabled("course")
                  ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                  : "bg-white text-gray-700 hover:bg-gray-50"
            }`}
          >
            {getScopeLabel("course")}
          </button>
          <button
            onClick={() => setActiveScope("global")}
            className={`flex-1 px-3 py-1.5 text-xs font-medium rounded transition-colors ${
              activeScope === "global"
                ? "bg-[#0d7377] text-white"
                : "bg-white text-gray-700 hover:bg-gray-50"
            }`}
          >
            {getScopeLabel("global")}
          </button>
        </div>

        <div className="flex gap-2">
          <input
            ref={searchInputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search lesson content..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#0d7377] focus:border-transparent"
          />
          <button
            onClick={() => handleSearch(0)}
            disabled={isLoading || query.length < 2}
            className="px-4 py-2 bg-[#0d7377] text-white text-sm font-medium rounded-md hover:bg-[#0a5c5f] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? "Searching..." : "Search"}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
            {error}
          </div>
        )}

        {results.length === 0 && !isLoading && query.length >= 2 && (
          <div className="text-center text-gray-500 py-8">
            No results found for "{query}"
          </div>
        )}

        {results.length > 0 && (
          <div className="space-y-4">
            <div className="text-sm text-gray-600 mb-2">
              Found {totalResults} result{totalResults !== 1 ? "s" : ""}
            </div>

            {results.map((result, index) => (
              <div key={`${result.lesson_id}-${result.field_name}-${index}`} className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <span className="text-xs font-medium text-[#0d7377]">
                      {result.course_title}
                    </span>
                    <span className="text-xs text-gray-400 mx-2">•</span>
                    <span className="text-xs text-gray-500">
                      Grade {result.grade}
                    </span>
                  </div>
                  <span className="text-xs text-gray-500">
                    Lesson {result.lesson_number}
                  </span>
                </div>

                <h4 className="font-medium text-gray-900 mb-1 text-sm">
                  {result.lesson_title}
                </h4>

                <div className="text-xs text-gray-500 mb-2">
                  {getFieldLabel(result.field_name)}
                </div>

                <div 
                  className="text-sm text-gray-700 line-clamp-3"
                  dangerouslySetInnerHTML={{ __html: result.chunk_text }}
                />
              </div>
            ))}

            {hasMore && (
              <button
                onClick={loadMore}
                disabled={isLoading}
                className="w-full py-2 text-sm text-[#0d7377] hover:bg-gray-50 rounded-md disabled:opacity-50"
              >
                {isLoading ? "Loading..." : "Load More"}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
