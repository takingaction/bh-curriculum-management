-- Profiles (extends auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  role TEXT NOT NULL CHECK (role IN ('admin', 'teacher')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Courses
CREATE TABLE IF NOT EXISTS public.courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  discipline TEXT NOT NULL,
  grade TEXT NOT NULL,
  total_lessons INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Lessons
CREATE TABLE IF NOT EXISTS public.lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  lesson_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  total_time TEXT,
  lesson_outline TEXT,
  learning_objectives TEXT,
  vocabulary TEXT,
  materials TEXT,
  vapa_text_block TEXT,
  ncas_text_block TEXT,
  welcome_opening TEXT,
  actual_class_expectations TEXT,
  lesson_hook TEXT,
  warm_up TEXT,
  main_activity TEXT,
  instrument_expectations TEXT,
  reflection TEXT,
  closing_ceremony TEXT,
  assessment TEXT,
  lesson_images JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(course_id, lesson_number)
);

-- Teacher Assignments
CREATE TABLE IF NOT EXISTS public.teacher_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(teacher_id, course_id)
);

-- Adapted Lessons (AI-modified copies)
CREATE TABLE IF NOT EXISTS public.adapted_lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_lesson_id UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT,
  lesson_outline TEXT,
  learning_objectives TEXT,
  vocabulary TEXT,
  materials TEXT,
  vapa_text_block TEXT,
  ncas_text_block TEXT,
  welcome_opening TEXT,
  actual_class_expectations TEXT,
  lesson_hook TEXT,
  warm_up TEXT,
  main_activity TEXT,
  instrument_expectations TEXT,
  reflection TEXT,
  closing_ceremony TEXT,
  assessment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- AI Usage Counters
CREATE TABLE IF NOT EXISTS public.ai_usage_counters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  window_start TIMESTAMPTZ NOT NULL,
  request_count INTEGER DEFAULT 0,
  UNIQUE(user_id, window_start)
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.adapted_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage_counters ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Admins can insert profiles" ON public.profiles FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Admins can update profiles" ON public.profiles FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Courses policies
CREATE POLICY "Admins full access courses" ON public.courses FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Teachers read assigned courses" ON public.courses FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.teacher_assignments WHERE teacher_id = auth.uid() AND course_id = public.courses.id)
);

-- Lessons policies
CREATE POLICY "Admins full access lessons" ON public.lessons FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Teachers read lessons in assigned courses" ON public.lessons FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.teacher_assignments WHERE teacher_id = auth.uid() AND course_id = lessons.course_id)
);

-- Teacher assignments policies
CREATE POLICY "Admins manage assignments" ON public.teacher_assignments FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Teachers view own assignments" ON public.teacher_assignments FOR SELECT USING (teacher_id = auth.uid());

-- Adapted lessons policies
CREATE POLICY "Teachers manage own adapted lessons" ON public.adapted_lessons FOR ALL USING (teacher_id = auth.uid());
CREATE POLICY "Admins read adapted lessons" ON public.adapted_lessons FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- AI counters policies
CREATE POLICY "Users manage own counters" ON public.ai_usage_counters FOR ALL USING (user_id = auth.uid());

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role)
  VALUES (new.id, new.email, 'teacher');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update course lesson count
CREATE OR REPLACE FUNCTION public.update_course_lesson_count()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.courses SET total_lessons = total_lessons + 1 WHERE id = NEW.course_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.courses SET total_lessons = total_lessons - 1 WHERE id = OLD.course_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_lesson_change ON public.lessons;
CREATE TRIGGER on_lesson_change
  AFTER INSERT OR DELETE ON public.lessons
  FOR EACH ROW EXECUTE FUNCTION public.update_course_lesson_count();
