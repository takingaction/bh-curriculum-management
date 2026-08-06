"use client";

import { createContext, useContext, useState, ReactNode } from "react";

interface ChatContextType {
  lessonId: string | null;
  courseId: string | null;
  setPageContext: (lessonId: string | null, courseId: string | null) => void;
}

const ChatContext = createContext<ChatContextType>({
  lessonId: null,
  courseId: null,
  setPageContext: () => {},
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

  const setPageContext = (lesson: string | null, course: string | null) => {
    setLessonId(lesson);
    setCourseId(course);
  };

  return (
    <ChatContext.Provider value={{ lessonId, courseId, setPageContext }}>
      {children}
    </ChatContext.Provider>
  );
}
