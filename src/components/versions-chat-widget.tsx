"use client";

import { useState, useRef, useEffect } from "react";
import { useChatContext } from "./chat-context";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const LANGUAGE_PATTERN = /\b(russian|spanish|french|german|portuguese|chinese|japanese|korean|arabic|hindi|italian|dutch|polish|vietnamese|greek|hebrew|thai|urdu|swahili|tagalog|creole)\b/i;

export function VersionsChatWidget() {
  const { lessonId, courseId, editingVersionId, onSaveVersionRequest, onSaveAsRequest } = useChatContext();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [waitingForConfirmation, setWaitingForConfirmation] = useState(false);
  const [confirmationModificationType, setConfirmationModificationType] = useState<string | null>(null);
  const [hasModification, setHasModification] = useState(false);
  const [modificationPreview, setModificationPreview] = useState<Record<string, unknown> | null>(null);
  const [previewEditingVersionId, setPreviewEditingVersionId] = useState<string | null>(null);
  const [versionMode, setVersionMode] = useState<'create' | 'edit' | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [pendingMode, setPendingMode] = useState<'create' | 'edit' | null>(null);
  const [detectedLanguage, setDetectedLanguage] = useState<string | null>(null);
  const [originalTargetLanguage, setOriginalTargetLanguage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const clearChat = () => {
    setMessages([]);
    setWaitingForConfirmation(false);
    setConfirmationModificationType(null);
    setHasModification(false);
    setModificationPreview(null);
    setWaitingForConfirmation(false);
    setDetectedLanguage(null);
    setOriginalTargetLanguage(null);
  };

  const handleReset = () => {
    clearChat();
    setVersionMode(null);
    setPendingMode(null);
    setShowClearConfirm(false);
  };

  const handleCreateNew = () => {
    if (messages.length > 0) {
      setPendingMode('create');
      setShowClearConfirm(true);
    } else {
      setVersionMode('create');
    }
  };

  const handleEditSelected = () => {
    if (!editingVersionId) {
      return;
    }
    if (messages.length > 0) {
      setPendingMode('edit');
      setShowClearConfirm(true);
    } else {
      setVersionMode('edit');
    }
  };

  const confirmClearChat = () => {
    clearChat();
    setVersionMode(pendingMode);
    setShowClearConfirm(false);
    setPendingMode(null);
  };

  const cancelClearConfirm = () => {
    setShowClearConfirm(false);
    setPendingMode(null);
  };

  const extractLanguage = (text: string): string | null => {
    const match = text.toLowerCase().match(LANGUAGE_PATTERN);
    return match ? match[1] : null;
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading || !versionMode) return;

    const userMessage = input.trim();
    setInput("");

    // Check for language in user message
    const lang = extractLanguage(userMessage);
    if (lang) {
      setDetectedLanguage(lang);
      // Only set original target language once (when first modification request)
      if (!originalTargetLanguage && !waitingForConfirmation) {
        setOriginalTargetLanguage(lang);
      }
    }

    setMessages(prev => [...prev, { role: "user", content: userMessage }]);
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat/modify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage,
          lessonId,
          courseId,
          conversationHistory: messages.slice(-20),
          editingVersionId,
          versionMode,
          detectedLanguage: lang || detectedLanguage,
          originalTargetLanguage,
          waitingForConfirmation,
          confirmationModificationType: confirmationModificationType,
        }),
      });

      const data = await response.json();
      setMessages(prev => [...prev, { role: "assistant", content: data.response }]);
      
      if (data.needsConfirmation) {
        setWaitingForConfirmation(true);
        if (data.modificationType) {
          setConfirmationModificationType(data.modificationType);
        }
      }
      
      if (data.isModificationRequest && data.modificationPreview) {
        setModificationPreview(data.modificationPreview);
        setPreviewEditingVersionId(data.editingVersionId || null);
        setHasModification(true);
      }
    } catch (error) {
      setMessages(prev => [
        ...prev,
        { role: "assistant", content: "Error: Failed to get response. Please try again." },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleProceed = async () => {
    if (!modificationPreview && !waitingForConfirmation) return;

    setIsLoading(true);

    try {
      const response = await fetch("/api/chat/modify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: "Proceed with modification",
          lessonId,
          courseId,
          conversationHistory: messages.slice(-20),
          editingVersionId,
          versionMode,
          detectedLanguage,
          originalTargetLanguage,
          waitingForConfirmation: true,
          userSaidProceed: true,
          confirmationModificationType,
        }),
      });

      const data = await response.json();
      
      // Add AI response to messages
      if (data.response) {
        setMessages(prev => [...prev, { role: "assistant", content: data.response }]);
      }
      
      setWaitingForConfirmation(false);
      setHasModification(false);
      setModificationPreview(null);
      
      if (data.modificationPreview && data.suggestedVersionName) {
        onSaveVersionRequest?.(data.modificationPreview, data.editingVersionId || null, data.suggestedVersionName);
      }
    } catch (error) {
      setMessages(prev => [
        ...prev,
        { role: "assistant", content: "Error: Failed to create version. Please try again." },
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

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-3 border-b border-gray-200">
        <span className="text-sm font-medium text-gray-700">Versions</span>
        {!lessonId && (
          <span className="text-xs text-gray-500">No lesson selected</span>
        )}
      </div>

      {lessonId && (
        <div className="p-3 border-b border-gray-200 space-y-2">
          <div className="flex gap-2">
            <button
              onClick={handleCreateNew}
              className={`flex-1 px-3 py-2 text-sm font-medium rounded transition-colors ${
                versionMode === 'create'
                  ? "bg-[#e85d5d] text-white"
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              }`}
            >
              Create New
            </button>
            <button
              onClick={handleEditSelected}
              className={`flex-1 px-3 py-2 text-sm font-medium rounded transition-colors ${
                versionMode === 'edit'
                  ? "bg-[#0d7377] text-white"
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              }`}
            >
              Edit Selected
            </button>
          </div>
          {versionMode === 'edit' && !editingVersionId && (
            <p className="text-xs text-orange-600">Select a version from the sidebar first.</p>
          )}
          {versionMode && (
            <p className="text-xs text-gray-500">
              {versionMode === 'create'
                ? "Creating a new version. All modifications will be saved as a new version."
                : "Editing selected version. All modifications will update the selected version."}
            </p>
          )}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {!lessonId ? (
          <div className="text-center text-gray-500 py-8 text-sm">
            Please open a lesson to create versions
          </div>
        ) : messages.length === 0 && !versionMode ? (
          <div className="text-center text-gray-500 py-8 text-sm">
            Select Create New or Edit Selected to work with versions.
          </div>
        ) : messages.length === 0 && versionMode ? (
          <div className="text-center text-gray-500 py-8 text-sm">
            Ask me to create a modified version of this lesson.<br /><br />
            For example:<br />
            - "Make a 30 minute version"<br />
            - "Translate to Russian"
          </div>
        ) : (
          <>
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
          </>
        )}

        <div ref={messagesEndRef} />
      </div>

      {showClearConfirm && (
        <div className="p-3 border-t border-gray-200 bg-gray-50">
          <p className="text-sm text-gray-700 mb-2">This will clear the current conversation. Continue?</p>
          <div className="flex gap-2">
            <button
              onClick={cancelClearConfirm}
              className="flex-1 px-3 py-1.5 bg-gray-200 text-gray-700 text-xs font-medium rounded hover:bg-gray-300 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={confirmClearChat}
              className="flex-1 px-3 py-1.5 bg-[#0d7377] text-white text-xs font-medium rounded hover:bg-[#0a5c5f] transition-colors"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {versionMode && !showClearConfirm && (
        <div className="p-3 border-t border-gray-200 bg-gray-50">
          <div className="flex gap-2">
            <button
              onClick={handleReset}
              className="flex-1 px-3 py-1.5 bg-gray-200 text-gray-700 text-xs font-medium rounded hover:bg-gray-300 transition-colors"
            >
              Reset
            </button>
            <button
              onClick={handleProceed}
              disabled={isLoading}
              className="flex-1 px-3 py-1.5 bg-[#0d7377] text-white text-xs font-medium rounded hover:bg-[#0a5c5f] transition-colors disabled:opacity-50"
            >
              {isLoading ? "Creating..." : "Proceed"}
            </button>
          </div>
        </div>
      )}

      {lessonId && (
        <form onSubmit={handleSubmit} className="p-3 border-t border-gray-200">
          <div className="flex gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={versionMode ? "Chat with AI to create your version..." : "Select Create New or Edit Selected first..."}
              disabled={!versionMode || isLoading}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#0d7377] focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
              rows={1}
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim() || !versionMode}
              className="px-4 py-2 bg-[#0d7377] text-white text-sm font-medium rounded-md hover:bg-[#0a5c5f] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Send
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
