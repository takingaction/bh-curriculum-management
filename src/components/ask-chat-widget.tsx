"use client";

import { useState, useRef, useEffect } from "react";
import { useChatContext } from "./chat-context";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type ScopeType = 'curriculum' | 'course' | 'lesson';

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

const CHAT_STORAGE_KEY = 'aiChatHistory_ask';
const SCOPE_STORAGE_KEY = 'aiChatScope_ask';
const MAX_STORED_MESSAGES = 50;

function loadMessages(): Message[] {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem(CHAT_STORAGE_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      localStorage.removeItem(CHAT_STORAGE_KEY);
    }
  }
  return [];
}

function loadScope(): ScopeType | null {
  if (typeof window === 'undefined') return null;
  const stored = localStorage.getItem(SCOPE_STORAGE_KEY);
  if (stored === 'curriculum' || stored === 'course' || stored === 'lesson') {
    return stored;
  }
  return null;
}

export function AskChatWidget() {
  const { lessonId, courseId } = useChatContext();
  const [messages, setMessages] = useState<Message[]>(loadMessages);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [links, setLinks] = useState<Link[]>([]);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [activeScope, setActiveScope] = useState<ScopeType | null>(loadScope);
  const [copyFeedback, setCopyFeedback] = useState<number | null>(null);
  const [exportFeedback, setExportFeedback] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const handleScopeToggle = (scope: ScopeType) => {
    if (activeScope === scope) {
      setActiveScope(null);
    } else {
      setActiveScope(scope);
    }
  };

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (messages.length <= MAX_STORED_MESSAGES) {
      localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages));
    } else {
      const trimmed = messages.slice(-MAX_STORED_MESSAGES);
      localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(trimmed));
    }
  }, [messages]);

  useEffect(() => {
    localStorage.setItem(SCOPE_STORAGE_KEY, activeScope || '');
  }, [activeScope]);

  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === CHAT_STORAGE_KEY) {
        if (e.newValue) {
          try {
            setMessages(JSON.parse(e.newValue));
          } catch {
            setMessages([]);
          }
        } else {
          setMessages([]);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: userMessage }]);
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage,
          lessonId,
          courseId,
          scope: activeScope,
          conversationHistory: messages.slice(-20),
        }),
      });

      const data = await response.json();
      setMessages(prev => [...prev, { role: "assistant", content: data.response }]);
      setLinks(data.links || []);
      setSearchResults(data.results || []);
    } catch (error) {
      setMessages(prev => [
        ...prev,
        { role: "assistant", content: "Error: Failed to get response. Please try again." },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const clearChat = () => {
    setMessages([]);
    localStorage.removeItem(CHAT_STORAGE_KEY);
  };

  const handleCopyMessage = async (content: string, index: number) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopyFeedback(index);
      setTimeout(() => setCopyFeedback(null), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const handleExportMessage = async (content: string, index: number) => {
    try {
      const response = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, format: "docx" }),
      });

      if (!response.ok) {
        throw new Error("Export failed");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "ai-response.docx";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      setExportFeedback(index);
      setTimeout(() => setExportFeedback(null), 2000);
    } catch (err) {
      console.error("Failed to export:", err);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-3 border-b border-gray-200">
        <div className="flex items-center gap-1">
          <span className="text-sm font-medium text-gray-700 mr-2">Ask</span>
          <button
            onClick={() => handleScopeToggle('curriculum')}
            className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
              activeScope === 'curriculum'
                ? 'bg-[#0d7377] text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Curriculum
          </button>
          <button
            onClick={() => handleScopeToggle('course')}
            disabled={!courseId}
            title={!courseId ? 'Navigate to a course to enable' : undefined}
            className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
              activeScope === 'course'
                ? 'bg-[#0d7377] text-white'
                : !courseId
                  ? 'bg-gray-50 text-gray-300 cursor-not-allowed'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Course
          </button>
          <button
            onClick={() => handleScopeToggle('lesson')}
            disabled={!lessonId}
            title={!lessonId ? 'Navigate to a lesson to enable' : undefined}
            className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
              activeScope === 'lesson'
                ? 'bg-[#0d7377] text-white'
                : !lessonId
                  ? 'bg-gray-50 text-gray-300 cursor-not-allowed'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Lesson
          </button>
        </div>
        <button
          onClick={clearChat}
          className="text-xs text-gray-500 hover:text-gray-700 ml-2"
        >
          Clear
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 py-8 text-sm">
            Ask me anything about your curriculum!<br /><br />
            <span className="text-xs text-gray-400">
              Select a scope above to search specific content
            </span>
          </div>
        )}

        {messages.map((msg, index) => (
          <div key={index} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] rounded-lg px-3 py-2 ${
                msg.role === "user"
                  ? "bg-[#0d7377] text-white"
                  : "bg-gray-100 text-gray-900"
              }`}
            >
              {msg.role === "assistant" && (
                <div className="flex justify-end gap-1 mb-1">
                  <button
                    onClick={() => handleCopyMessage(msg.content, index)}
                    className="p-1 hover:bg-gray-200 rounded text-gray-500 hover:text-gray-700"
                    title="Copy to clipboard"
                  >
                    {copyFeedback === index ? (
                      <span className="text-xs text-green-600">Copied!</span>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
                        <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
                      </svg>
                    )}
                  </button>
                  <button
                    onClick={() => handleExportMessage(msg.content, index)}
                    className="p-1 hover:bg-gray-200 rounded text-gray-500 hover:text-gray-700"
                    title="Export as Word document"
                  >
                    {exportFeedback === index ? (
                      <span className="text-xs text-green-600">Done!</span>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                        <polyline points="7 10 12 15 17 10"/>
                        <line x1="12" x2="12" y1="15" y2="3"/>
                      </svg>
                    )}
                  </button>
                </div>
              )}
              <div className="text-sm markdown-content">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {msg.content}
                </ReactMarkdown>
              </div>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-lg px-3 py-2">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}

        {searchResults.length > 0 && (
          <div className="border-t border-gray-200 pt-4 mt-4">
            <div className="text-xs text-gray-500 mb-2">Search Results</div>
            <div className="space-y-2">
              {searchResults.slice(0, 5).map((result, index) => (
                <div key={index} className="bg-white border border-gray-200 rounded p-2 text-xs">
                  <div className="font-medium">{result.lesson_title}</div>
                  <div className="text-gray-500">{result.course_title} - Grade {result.grade}</div>
                  <div className="text-gray-600 mt-1 line-clamp-2" dangerouslySetInnerHTML={{ __html: result.chunk_text }} />
                </div>
              ))}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="p-3 border-t border-gray-200">
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your curriculum..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#0d7377] focus:border-transparent"
            rows={1}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="px-4 py-2 bg-[#0d7377] text-white text-sm font-medium rounded-md hover:bg-[#0a5c5f] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
