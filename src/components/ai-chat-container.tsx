"use client";

import { useState } from "react";
import { AskChatWidget } from "./ask-chat-widget";
import { SearchChatWidget } from "./search-chat-widget";
import { VersionsChatWidget } from "./versions-chat-widget";

type TabType = "ask" | "search" | "versions";

export function AIChatContainer() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>("ask");

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
    <div className="fixed bottom-6 right-6 z-50 w-[32rem] max-w-[calc(100vw-3rem)] h-[32rem] min-h-[32rem] bg-white rounded-lg shadow-xl flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-[#0d7377] text-white rounded-t-lg h-12 flex-shrink-0">
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
        <button
          onClick={() => setIsOpen(false)}
          className="p-1 hover:bg-white/20 rounded transition-colors"
          title="Close"
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
            <path d="M18 6L6 18" />
            <path d="M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="flex border-b border-gray-200 h-10 flex-shrink-0">
        <button
          onClick={() => setActiveTab("ask")}
          className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "ask"
              ? "bg-[#0d7377] text-white"
              : "text-gray-600 hover:bg-gray-50"
          }`}
        >
          Ask
        </button>
        <button
          onClick={() => setActiveTab("versions")}
          className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "versions"
              ? "bg-[#0d7377] text-white"
              : "text-gray-600 hover:bg-gray-50"
          }`}
        >
          Versions
        </button>
        <button
          onClick={() => setActiveTab("search")}
          className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "search"
              ? "bg-[#0d7377] text-white"
              : "text-gray-600 hover:bg-gray-50"
          }`}
        >
          Search
        </button>
      </div>

      <div className="flex-shrink-0 h-[calc(32rem-88px)]">
        {activeTab === "ask" && <AskChatWidget />}
        {activeTab === "search" && <SearchChatWidget />}
        {activeTab === "versions" && <VersionsChatWidget />}
      </div>
    </div>
  );
}
