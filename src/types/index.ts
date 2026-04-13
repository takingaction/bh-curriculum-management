export type Role = "admin" | "teacher";

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: Role;
  created_at: string;
}

export interface Course {
  id: string;
  title: string;
  discipline: string;
  grade: string;
  total_lessons: number;
  created_at: string;
  updated_at: string;
}

export interface Lesson {
  id: string;
  course_id: string;
  lesson_number: number;
  title: string;
  total_time: string | null;
  lesson_outline: string | null;
  learning_objectives: string | null;
  vocabulary: string | null;
  materials: string | null;
  vapa_text_block: string | null;
  ncas_text_block: string | null;
  welcome_opening: string | null;
  actual_class_expectations: string | null;
  lesson_hook: string | null;
  warm_up: string | null;
  main_activity: string | null;
  instrument_expectations: string | null;
  reflection: string | null;
  closing_ceremony: string | null;
  assessment: string | null;
  lesson_images: string[];
  created_at: string;
}

export interface TeacherAssignment {
  id: string;
  teacher_id: string;
  course_id: string;
  assigned_at: string;
  course?: Course;
}

export interface AdaptedLesson {
  id: string;
  original_lesson_id: string;
  teacher_id: string;
  title: string | null;
  lesson_outline: string | null;
  learning_objectives: string | null;
  vocabulary: string | null;
  materials: string | null;
  vapa_text_block: string | null;
  ncas_text_block: string | null;
  welcome_opening: string | null;
  actual_class_expectations: string | null;
  lesson_hook: string | null;
  warm_up: string | null;
  main_activity: string | null;
  instrument_expectations: string | null;
  reflection: string | null;
  closing_ceremony: string | null;
  assessment: string | null;
  created_at: string;
}

export interface AIUsageCounter {
  id: string;
  user_id: string;
  window_start: string;
  request_count: number;
}
