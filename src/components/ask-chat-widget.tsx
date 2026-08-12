"use client";

import { useState, useRef, useEffect } from "react";
import { useChatContext } from "./chat-context";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

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
const MAX_STORED_MESSAGES = 50;

export function AskChatWidget() {
  const { lessonId, courseId } = useChatContext();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [links, setLinks] = useState<Link[]>([]);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const stored = localStorage.getItem(CHAT_STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setMessages(parsed);
      } catch (e) {
        localStorage.removeItem(CHAT_STORAGE_KEY);
      }
    }
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

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-3 border-b border-gray-200">
        <span className="text-sm font-medium text-gray-700">Ask</span>
        {messages.length > 0 && (
          <button
            onClick={clearChat}
            className="text-xs text-gray-500 hover:text-gray-700"
          >
            Clear
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 py-8 text-sm">
            Ask me anything about your curriculum!<br /><br />
            <span className="text-xs text-gray-400">
              Use prefixes: curriculum:, course:, lesson:
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
