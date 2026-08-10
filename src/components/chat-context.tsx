"use client";

import { createContext, useContext, useState, useRef, useCallback, useEffect, ReactNode } from "react";

interface ClearCallback {
  fn: (() => void) | null;
}

interface ChatContextType {
  lessonId: string | null;
  courseId: string | null;
  editingVersionId: string | null;
  versionCount: number;
  setPageContext: (lessonId: string | null, courseId: string | null) => void;
  setEditingVersionId: (versionId: string | null) => void;
  setVersionCount: (count: number) => void;
  onSaveVersionRequest: ((preview: Record<string, unknown>, editingVersionId: string | null) => void) | null;
  setSaveVersionCallback: (callback: ((preview: Record<string, unknown>, editingVersionId: string | null) => void) | null) => void;
  clearModificationCallback: (() => void) | null;
  setClearModificationCallback: (callback: (() => void) | null) => void;
}

const ChatContext = createContext<ChatContextType>({
  lessonId: null,
  courseId: null,
  editingVersionId: null,
  versionCount: 0,
  setPageContext: () => {},
  setEditingVersionId: () => {},
  setVersionCount: () => {},
  onSaveVersionRequest: null,
  setSaveVersionCallback: () => {},
  clearModificationCallback: null,
  setClearModificationCallback: () => {},
});

export function useChatContext() {
  return useContext(ChatContext);
}

interface ChatProviderProps {
  children: ReactNode;
}

export function ChatProvider({ children }: ChatProviderProps) {
  const [lessonId, setLessonId] = useState<string | null>(null);
  const [courseId, setCourseId] = useState<string | null>(null);
  const [editingVersionId, setEditingVersionId] = useState<string | null>(null);
  const [versionCount, setVersionCount] = useState(0);
  const [callbackVersion, setCallbackVersion] = useState(0);
  const saveCallbackRef = useRef<((preview: Record<string, unknown>, editingVersionId: string | null) => void) | null>(null);
  const clearCallbackRef = useRef<(() => void) | null>(null);

  const setPageContext = useCallback((lesson: string | null, course: string | null) => {
    setLessonId(lesson);
    setCourseId(course);
  }, []);

  const setEditingVersionIdCallback = useCallback((versionId: string | null) => {
    setEditingVersionId(versionId);
  }, []);

  const setSaveVersionCallback = useCallback((callback: ((preview: Record<string, unknown>, editingVersionId: string | null) => void) | null) => {
    saveCallbackRef.current = callback;
    setCallbackVersion(v => v + 1);
  }, []);

  const setClearModificationCallback = useCallback((callback: (() => void) | null) => {
    clearCallbackRef.current = callback;
    setCallbackVersion(v => v + 1);
  }, []);

  const value = {
    lessonId,
    courseId,
    editingVersionId,
    versionCount,
    setPageContext,
    setEditingVersionId: setEditingVersionIdCallback,
    setVersionCount,
    onSaveVersionRequest: saveCallbackRef.current,
    setSaveVersionCallback,
    clearModificationCallback: clearCallbackRef.current,
    setClearModificationCallback,
  };

  return (
    <ChatContext.Provider value={value}>
      {children}
    </ChatContext.Provider>
  );
}
