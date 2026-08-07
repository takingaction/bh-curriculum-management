"use client";

import { useState, useRef, useEffect } from "react";
import { useChatContext } from "./chat-context";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface Link {
  label: string;
  url: string;
}

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

interface Course {
  id: string;
  title: string;
  discipline?: string;
  grade?: string;
}

const CHAT_STORAGE_KEY = 'aiChatHistory';
const SEARCH_STORAGE_KEY = 'aiSearchState';
const MAX_STORED_MESSAGES = 50;

interface SearchState {
  results: SearchResult[];
  totalResults: number;
  hasMore: boolean;
  page: number;
  query: string;
  scope: "lesson" | "course" | "global";
  lessonId: string | null;
  courseId: string | null;
}

export default function AIChatWidget() {
  const { lessonId, courseId } = useChatContext();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(CHAT_STORAGE_KEY);
        return saved ? JSON.parse(saved) : [];
      } catch {
        return [];
      }
    }
    return [];
  });
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [links, setLinks] = useState<Link[]>([]);
  const [directResults, setDirectResults] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"results" | "links">("results");
  const [resultsMinimized, setResultsMinimized] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const [activeMode, setActiveMode] = useState<"ask" | "search">("ask");
  const [searchScope, setSearchScope] = useState<"lesson" | "course" | "global">("global");
  const [searchQuery, setSearchQuery] = useState("");
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>("");
  const [isSearching, setIsSearching] = useState(false);

  const searchParamsRef = useRef<{ query: string; scope: "lesson" | "course" | "global"; lessonId: string | null; courseId: string | null }>({ query: "", scope: "global", lessonId: null, courseId: null });
  const [searchPage, setSearchPage] = useState(0);
  const [searchTotalResults, setSearchTotalResults] = useState(0);
  const [searchHasMore, setSearchHasMore] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(SEARCH_STORAGE_KEY);
        if (saved) {
          const state: SearchState = JSON.parse(saved);
          if (state.results && state.results.length > 0) {
            return state.results;
          }
        }
      } catch { }
    }
    return [];
  });

  useEffect(() => {
    if (courseId) {
      setSelectedCourseId(courseId);
    }
  }, [courseId]);

  useEffect(() => {
    if (activeMode === "search" && searchScope === "course" && courses.length === 0) {
      fetch("/api/admin/courses")
        .then(res => res.json())
        .then(data => setCourses(data.courses || []))
        .catch(err => console.error("Failed to fetch courses:", err));
    }
  }, [activeMode, searchScope]);

  useEffect(() => {
    try {
      const trimmed = messages.slice(-MAX_STORED_MESSAGES);
      localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(trimmed));
    } catch {
      if (messages.length > MAX_STORED_MESSAGES) {
        const trimmed = messages.slice(-MAX_STORED_MESSAGES);
        setMessages(trimmed);
      }
    }
  }, [messages]);

  useEffect(() => {
    if (searchResults.length > 0 || searchTotalResults > 0) {
      try {
        const state: SearchState = {
          results: searchResults,
          totalResults: searchTotalResults,
          hasMore: searchHasMore,
          page: searchPage,
          query: searchQuery,
          scope: searchScope,
          lessonId,
          courseId,
        };
        localStorage.setItem(SEARCH_STORAGE_KEY, JSON.stringify(state));
      } catch { }
    }
  }, [searchResults, searchTotalResults, searchHasMore, searchPage, searchQuery, searchScope]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(SEARCH_STORAGE_KEY);
        if (saved) {
          const state: SearchState = JSON.parse(saved);
          if (state.results && state.results.length > 0) {
            setSearchResults(state.results);
            setSearchTotalResults(state.totalResults);
            setSearchHasMore(state.hasMore);
            setSearchPage(state.page);
            const restoredQuery = state.query || "";
            setSearchQuery(restoredQuery);
            if (state.scope) setSearchScope(state.scope);
            setResultsMinimized(false);
            searchParamsRef.current = {
              query: restoredQuery,
              scope: (state.scope || "global") as "lesson" | "course" | "global",
              lessonId: state.lessonId || null,
              courseId: state.courseId || null,
            };
          }
        }
      } catch { }
    }
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setIsLoading(true);

    try {
      const conversationHistory = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage,
          lessonId,
          courseId,
          conversationHistory,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to get response");
      }

      const data = await response.json();
      setMessages((prev) => [...prev, { role: "assistant", content: data.response }]);
      setLinks(data.links || []);
      setSearchResults(data.results || []);
      setDirectResults(data.directResults || null);
      setSearchTotalResults(data.totalResults || 0);
      setSearchHasMore(data.hasMore || false);
      if (data.results && data.results.length > 0 && userMessage) {
        setSearchQuery(userMessage);
        searchParamsRef.current = { query: userMessage, scope: searchScope, lessonId, courseId };
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Error: ${message}. Please try again.` },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const clearChat = () => {
    setMessages([]);
    setLinks([]);
    setSearchResults([]);
    setDirectResults(null);
    setSearchPage(0);
    setSearchTotalResults(0);
    setSearchHasMore(false);
    setSearchQuery("");
    localStorage.removeItem(CHAT_STORAGE_KEY);
    localStorage.removeItem(SEARCH_STORAGE_KEY);
  };

  const handleSearch = async () => {
    if (!searchQuery.trim() || isSearching) return;

    setIsSearching(true);
    setSearchResults([]);
    setDirectResults(null);
    setActiveMode("ask");
    setResultsMinimized(true);
    setSearchPage(0);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: searchQuery,
          scope: searchScope,
          searchQuery: searchQuery,
          lessonId: searchScope === "lesson" ? lessonId : null,
          courseId: searchScope === "course" ? selectedCourseId : null,
          page: 0,
          pageSize: 10,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Search failed");
      }

      const data = await response.json();

      if (data.results && data.results.length > 0) {
        setSearchResults(data.results);
        setDirectResults(data.directResults || null);
        setSearchTotalResults(data.totalResults || data.results.length);
        setSearchHasMore(data.hasMore || false);
        setActiveTab("results");
        const responseMsg = data.response
          ? `${data.response}. Click the Results tab below to view them.`
          : `Found ${data.results.length} matches. Click the Results tab below to view them.`;
        setMessages(prev => [...prev,
          { role: "user" as const, content: `Search: "${searchQuery}" (${searchScope})` },
          { role: "assistant" as const, content: responseMsg }
        ]);
      } else {
        setSearchTotalResults(0);
        setSearchHasMore(false);
        setMessages(prev => [...prev,
          { role: "user" as const, content: `Search: "${searchQuery}" (${searchScope})` },
          { role: "assistant" as const, content: data.response || "No results found." }
        ]);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Search error";
      setMessages(prev => [...prev,
        { role: "user" as const, content: `Search: "${searchQuery}"` },
        { role: "assistant" as const, content: `Error: ${message}` }
      ]);
    } finally {
      setIsSearching(false);
    }
  };

  const loadMoreResults = async () => {
    if (isSearching || !searchHasMore) return;

    const query = searchQuery || searchParamsRef.current.query;
    const scope = searchScope || searchParamsRef.current.scope;
    const lid = lessonId || searchParamsRef.current.lessonId;
    const cid = courseId || searchParamsRef.current.courseId;

    if (!query) return;

    setIsSearching(true);
    const nextPage = searchPage + 1;

    const requestBody = {
      message: query,
      searchQuery: query,
      scope: scope,
      page: nextPage,
      pageSize: 10,
      lessonId: lid || undefined,
      courseId: cid || undefined,
    };

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Load more failed:", response.status, errorText);
        throw new Error(`Failed to load more: ${response.status}`);
      }

      const data = await response.json();

      if (data.results && data.results.length > 0) {
        setSearchResults(prev => [...prev, ...data.results]);
        setSearchPage(nextPage);
        setSearchHasMore(data.hasMore || false);
      } else {
        setSearchHasMore(false);
      }
    } catch (error) {
      console.error("Load more error:", error);
    } finally {
      setIsSearching(false);
    }
  };

  const renderMessage = (content: string) => {
    const parts = content.split(/(\[[^\]]+\]\([^)]+\))/g);

    return parts.map((part, i) => {
      const linkMatch = part.match(/\[([^\]]+)\]\(([^)]+)\)/);
      if (linkMatch) {
        return (
          <a
            key={i}
            href={linkMatch[2]}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#0d7377] hover:underline"
          >
            {linkMatch[1]}
          </a>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-[#0d7377] hover:bg-[#0a5c5f] text-white rounded-full shadow-lg flex items-center justify-center transition-colors"
        title="Open AI Assistant"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 8V4H8" />
          <rect width="16" height="12" x="4" y="8" rx="2" />
          <path d="M2 14h2" />
          <path d="M20 14h2" />
          <path d="M15 13v2" />
          <path d="M9 13v2" />
        </svg>
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 w-[32rem] max-w-[calc(100vw-3rem)] bg-white rounded-lg shadow-xl flex flex-col max-h-[32rem]">
      <div className="flex items-center justify-between px-4 py-3 bg-[#0d7377] text-white rounded-t-lg">
        <div className="flex items-center gap-2">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 8V4H8" />
            <rect width="16" height="12" x="4" y="8" rx="2" />
            <path d="M2 14h2" />
            <path d="M20 14h2" />
            <path d="M15 13v2" />
            <path d="M9 13v2" />
          </svg>
          <span className="font-semibold">AI Assistant</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={clearChat}
            className="p-1 hover:bg-white/20 rounded transition-colors"
            title="Clear chat"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 6h18" />
              <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
              <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
            </svg>
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1 hover:bg-white/20 rounded transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>
      </div>

      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveMode("ask")}
          className={`flex-1 px-4 py-2 text-sm font-medium ${
            activeMode === "ask"
              ? "text-[#0d7377] border-b-2 border-[#0d7377]"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          Ask
        </button>
        <button
          onClick={() => setActiveMode("search")}
          className={`flex-1 px-4 py-2 text-sm font-medium ${
            activeMode === "search"
              ? "text-[#0d7377] border-b-2 border-[#0d7377]"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          Search Content
        </button>
      </div>

      {activeMode === "search" && (
        <div className="p-4 border-b border-gray-200 bg-gray-50 space-y-3">
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                checked={searchScope === "lesson"}
                onChange={() => setSearchScope("lesson")}
                className="w-4 h-4"
              />
              <span className="text-sm">Lesson</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                checked={searchScope === "course"}
                onChange={() => setSearchScope("course")}
                className="w-4 h-4"
              />
              <span className="text-sm">Course</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                checked={searchScope === "global"}
                onChange={() => setSearchScope("global")}
                className="w-4 h-4"
              />
              <span className="text-sm">Global</span>
            </label>
          </div>

          {searchScope === "course" && (
            <select
              value={selectedCourseId}
              onChange={(e) => setSelectedCourseId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
            >
              {courses.length === 0 && <option value="">Loading courses...</option>}
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          )}

          <div className="flex gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleSearch();
                }
              }}
              placeholder="Enter search term..."
              className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#0d7377]"
            />
            <button
              onClick={handleSearch}
              disabled={!searchQuery.trim() || isSearching}
              className="px-4 py-2 bg-[#0d7377] text-white rounded text-sm hover:bg-[#0a5c5f] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSearching ? "..." : "Search"}
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 py-8">
            <p className="text-sm">Ask me about your curriculum or use the Search Content tab!</p>
            <p className="text-xs mt-2 text-gray-400">
              Click &quot;Search Content&quot; to search lessons by scope (lesson, course, or global).
            </p>
          </div>
        )}

        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-lg px-3 py-2 ${
                message.role === "user"
                  ? "bg-[#0d7377] text-white"
                  : "bg-gray-100 text-gray-800"
              }`}
            >
              <div className="text-sm whitespace-pre-wrap">
                {message.role === "assistant" ? renderMessage(message.content) : message.content}
              </div>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-lg px-3 py-2">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0.1s]" />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0.2s]" />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {searchResults.length > 0 && (
        <div className="px-4 py-2 bg-gray-50 border-t border-gray-200">
          <div className="flex items-center justify-between border-b border-gray-200 mb-2">
            <div className="flex">
              <button
                type="button"
                onClick={() => { setActiveTab("results"); setResultsMinimized(false); }}
                className={`px-3 py-1 text-xs font-medium ${
                  activeTab === "results"
                    ? "text-[#0d7377] border-b-2 border-[#0d7377]"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                Results {searchTotalResults > 0 && `(${searchTotalResults})`}
              </button>
              <button
                type="button"
                onClick={() => { setActiveTab("links"); setResultsMinimized(false); }}
                className={`px-3 py-1 text-xs font-medium ${
                  activeTab === "links"
                    ? "text-[#0d7377] border-b-2 border-[#0d7377]"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                Links {links.length > 0 && `(${links.length})`}
              </button>
            </div>
            <button
              type="button"
              onClick={() => setResultsMinimized(!resultsMinimized)}
              className="text-gray-400 hover:text-gray-600 text-xs px-2 py-1"
            >
              {resultsMinimized ? "Show" : "Hide"}
            </button>
          </div>

          {!resultsMinimized && (
            <div className="max-h-60 overflow-y-auto">
              {activeTab === "results" && searchResults.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs text-gray-500 px-2 pb-2">
                    Showing {searchResults.length} of {searchTotalResults} results
                  </div>
                  {searchResults.map((result, i) => (
                    <a
                      key={i}
                      href={`/lessons/${result.lesson_id}#${result.field_name}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block p-3 bg-gray-50 rounded border border-gray-200 hover:border-[#0d7377]"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2 text-xs">
                          <span className="font-medium text-[#0d7377]">
                            Lesson {result.lesson_number}
                          </span>
                          <span className="text-gray-400">-</span>
                          <span className="text-gray-600">{result.course_title}</span>
                          <span className="text-gray-400">-</span>
                          <span className="text-gray-500">Grade {result.grade}</span>
                          <span className="text-gray-400">-</span>
                          <span className="font-medium text-gray-600">
                            {result.field_name === "vapa_text_block" ? "VAPA Standards" :
                             result.field_name === "ncas_text_block" ? "NCAS Standards" :
                             result.field_name === "welcome_opening" ? "Welcome and Opening Check-In" :
                             result.field_name === "actual_class_expectations" ? "Class Expectations" :
                             result.field_name === "lesson_hook" ? 'Lesson "Hook"' :
                             result.field_name === "main_activity" ? "Main Activity" :
                             result.field_name === "instrument_expectations" ? "Instrument Expectations" :
                             result.field_name === "closing_ceremony" ? "Closing Ceremony" :
                             result.field_name === "learning_objectives" ? "Learning Objectives" :
                             result.field_name === "vocabulary" ? "Vocabulary" :
                             result.field_name === "materials" ? "Materials" :
                             result.field_name === "warm_up" ? "Warm Up" :
                             result.field_name === "reflection" ? "Reflection" :
                             result.field_name === "assessment" ? "Assessment" :
                             result.field_name}
                          </span>
                        </div>
                        <span className="text-xs text-[#0d7377]">View →</span>
                      </div>
                      <p
                        className="text-sm text-gray-600"
                        dangerouslySetInnerHTML={{ __html: result.chunk_text }}
                      />
                    </a>
                  ))}

                  {searchHasMore && (
                    <button
                      onClick={loadMoreResults}
                      disabled={isSearching}
                      className="w-full py-2 text-xs text-[#0d7377] hover:bg-gray-100 rounded border border-gray-200 disabled:opacity-50"
                    >
                      {isSearching ? "Loading..." : `Load More (${searchTotalResults - searchResults.length} remaining)`}
                    </button>
                  )}
                </div>
              )}

              {activeTab === "links" && links.length > 0 && (
                <div className="space-y-2">
                  {links.slice(0, 10).map((link, i) => (
                    <a
                      key={i}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-xs bg-white p-2 rounded border border-gray-200 hover:border-[#0d7377]"
                    >
                      <div className="text-[#0d7377]">{link.label}</div>
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="p-3 border-t border-gray-200">
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder='Ask me about your curriculum...'
            className="flex-1 resize-none border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0d7377] focus:border-transparent"
            rows={1}
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="bg-[#0d7377] text-white rounded-lg px-3 py-2 hover:bg-[#0a5c5f] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m22 2-7 20-4-9-9-4Z" />
              <path d="M22 2 11 13" />
            </svg>
          </button>
        </div>
      </form>

      <div className="px-3 py-2 bg-gray-50 rounded-b-lg border-t border-gray-200">
        <p className="text-[10px] text-gray-400 text-center">
          AI-generated responses may contain inaccuracies. Always verify information.
        </p>
      </div>
    </div>
  );
}
