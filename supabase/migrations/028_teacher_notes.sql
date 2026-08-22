-- Teacher Notes: Per-user notes for courses and lessons
-- Each teacher has their own notes tied to their profile

CREATE TABLE IF NOT EXISTS public.teacher_course_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(teacher_id, course_id)
);

CREATE TABLE IF NOT EXISTS public.teacher_lesson_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(teacher_id, lesson_id)
);

-- RLS Policies: Teachers can read/write their own notes, admins can read all
ALTER TABLE public.teacher_course_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_lesson_notes ENABLE ROW LEVEL SECURITY;

-- Teachers can CRUD their own notes
CREATE POLICY "Teachers can CRUD own course notes"
  ON public.teacher_course_notes
  FOR ALL USING (auth.uid() = teacher_id);

CREATE POLICY "Teachers can CRUD own lesson notes"
  ON public.teacher_lesson_notes
  FOR ALL USING (auth.uid() = teacher_id);

-- Indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_teacher_course_notes_teacher ON public.teacher_course_notes(teacher_id);
CREATE INDEX IF NOT EXISTS idx_teacher_course_notes_course ON public.teacher_course_notes(course_id);
CREATE INDEX IF NOT EXISTS idx_teacher_lesson_notes_teacher ON public.teacher_lesson_notes(teacher_id);
CREATE INDEX IF NOT EXISTS idx_teacher_lesson_notes_lesson ON public.teacher_lesson_notes(lesson_id);
