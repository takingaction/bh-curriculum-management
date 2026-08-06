"use client";

import { useChatContext } from "./chat-context";
import { useEffect } from "react";

interface SetChatContextProps {
  lessonId?: string;
  courseId?: string;
}

export function SetChatContext({ lessonId, courseId }: SetChatContextProps) {
  const { setPageContext } = useChatContext();

  useEffect(() => {
    setPageContext(lessonId || null, courseId || null);
  }, [lessonId, courseId, setPageContext]);

  return null;
}
