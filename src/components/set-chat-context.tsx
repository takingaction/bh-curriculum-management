"use client";

import { useChatContext } from "./chat-context";
import { useEffect } from "react";

interface SetChatContextProps {
  lessonId?: string;
  courseId?: string;
  onSaveVersionRequest?: (preview: Record<string, unknown>) => void;
  onClearModification?: () => void;
}

export function SetChatContext({ lessonId, courseId, onSaveVersionRequest, onClearModification }: SetChatContextProps) {
  const { setPageContext, setSaveVersionCallback, setClearModificationCallback } = useChatContext();

  useEffect(() => {
    setPageContext(lessonId || null, courseId || null);
  }, [lessonId, courseId, setPageContext]);

  useEffect(() => {
    if (onSaveVersionRequest) {
      setSaveVersionCallback(onSaveVersionRequest);
    }
    return () => {
      setSaveVersionCallback(null);
    };
  }, [onSaveVersionRequest, setSaveVersionCallback]);

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
