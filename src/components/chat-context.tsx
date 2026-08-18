"use client";

import { createContext, useContext, useState, useRef, useCallback, ReactNode } from "react";

interface ChatContextType {
  userId: string | null;
  lessonId: string | null;
  courseId: string | null;
  editingVersionId: string | null;
  versionCount: number;
  versionMode: 'create' | 'edit' | null;
  setPageContext: (lessonId: string | null, courseId: string | null) => void;
  setEditingVersionId: (versionId: string | null) => void;
  setVersionCount: (count: number) => void;
  setVersionMode: (mode: 'create' | 'edit' | null) => void;
  onSaveVersionRequest: ((preview: Record<string, unknown>, editingVersionId: string | null, suggestedVersionName?: string) => void) | null;
  onSaveAsRequest: ((preview: Record<string, unknown>) => void) | null;
  setSaveVersionCallback: (callback: ((preview: Record<string, unknown>, editingVersionId: string | null, suggestedVersionName?: string) => void) | null) => void;
  setSaveAsCallback: (callback: ((preview: Record<string, unknown>) => void) | null) => void;
  clearModificationCallback: (() => void) | null;
  setClearModificationCallback: (callback: (() => void) | null) => void;
}

const ChatContext = createContext<ChatContextType>({
  userId: null,
  lessonId: null,
  courseId: null,
  editingVersionId: null,
  versionCount: 0,
  versionMode: null,
  setPageContext: () => {},
  setEditingVersionId: () => {},
  setVersionCount: () => {},
  setVersionMode: () => {},
  onSaveVersionRequest: null,
  onSaveAsRequest: null,
  setSaveVersionCallback: () => {},
  setSaveAsCallback: () => {},
  clearModificationCallback: null,
  setClearModificationCallback: () => {},
});

export function useChatContext() {
  return useContext(ChatContext);
}

interface ChatProviderProps {
  children: ReactNode;
  userId: string | null;
}

export function ChatProvider({ children, userId }: ChatProviderProps) {
  const [lessonId, setLessonId] = useState<string | null>(null);
  const [courseId, setCourseId] = useState<string | null>(null);
  const [editingVersionId, setEditingVersionId] = useState<string | null>(null);
  const [versionCount, setVersionCount] = useState(0);
  const [versionMode, setVersionMode] = useState<'create' | 'edit' | null>(null);
  const [callbackVersion, setCallbackVersion] = useState(0);
  const saveCallbackRef = useRef<((preview: Record<string, unknown>, editingVersionId: string | null, suggestedVersionName?: string) => void) | null>(null);
  const saveAsCallbackRef = useRef<((preview: Record<string, unknown>) => void) | null>(null);
  const clearCallbackRef = useRef<(() => void) | null>(null);

  const setPageContext = useCallback((lesson: string | null, course: string | null) => {
    setLessonId(lesson);
    setCourseId(course);
  }, []);

  const setEditingVersionIdCallback = useCallback((versionId: string | null) => {
    setEditingVersionId(versionId);
  }, []);

  const setSaveVersionCallback = useCallback((callback: ((preview: Record<string, unknown>, editingVersionId: string | null, suggestedVersionName?: string) => void) | null) => {
    saveCallbackRef.current = callback;
    setCallbackVersion(v => v + 1);
  }, []);

  const setSaveAsCallback = useCallback((callback: ((preview: Record<string, unknown>) => void) | null) => {
    saveAsCallbackRef.current = callback;
    setCallbackVersion(v => v + 1);
  }, []);

  const setClearModificationCallback = useCallback((callback: (() => void) | null) => {
    clearCallbackRef.current = callback;
    setCallbackVersion(v => v + 1);
  }, []);

  const value = {
    userId,
    lessonId,
    courseId,
    editingVersionId,
    versionCount,
    versionMode,
    setPageContext,
    setEditingVersionId: setEditingVersionIdCallback,
    setVersionCount,
    setVersionMode,
    onSaveVersionRequest: saveCallbackRef.current,
    onSaveAsRequest: saveAsCallbackRef.current,
    setSaveVersionCallback,
    setSaveAsCallback,
    clearModificationCallback: clearCallbackRef.current,
    setClearModificationCallback,
  };

  return (
    <ChatContext.Provider value={value}>
      {children}
    </ChatContext.Provider>
  );
}
