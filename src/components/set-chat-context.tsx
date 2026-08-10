"use client";

import { useChatContext } from "./chat-context";
import { useEffect } from "react";

interface SetChatContextProps {
  lessonId?: string;
  courseId?: string;
  editingVersionId?: string | null;
  onSaveVersionRequest?: (preview: Record<string, unknown>, editingVersionId: string | null) => void;
  onSaveAsRequest?: (preview: Record<string, unknown>) => void;
  onClearModification?: () => void;
}

export function SetChatContext({ lessonId, courseId, editingVersionId, onSaveVersionRequest, onSaveAsRequest, onClearModification }: SetChatContextProps) {
  const { setPageContext, setEditingVersionId, setSaveVersionCallback, setSaveAsCallback, setClearModificationCallback } = useChatContext();

  useEffect(() => {
    setPageContext(lessonId || null, courseId || null);
  }, [lessonId, courseId, setPageContext]);

  useEffect(() => {
    setEditingVersionId(editingVersionId !== undefined ? editingVersionId : null);
  }, [editingVersionId, setEditingVersionId]);

  useEffect(() => {
    if (onSaveVersionRequest) {
      setSaveVersionCallback(onSaveVersionRequest);
    }
    return () => {
      setSaveVersionCallback(null);
    };
  }, [onSaveVersionRequest, setSaveVersionCallback]);

  useEffect(() => {
    if (onSaveAsRequest) {
      setSaveAsCallback(onSaveAsRequest);
    }
    return () => {
      setSaveAsCallback(null);
    };
  }, [onSaveAsRequest, setSaveAsCallback]);

  useEffect(() => {
    if (onClearModification) {
      setClearModificationCallback(onClearModification);
    }
    return () => {
      setClearModificationCallback(null);
    };
  }, [onClearModification, setClearModificationCallback]);

  return null;
}
