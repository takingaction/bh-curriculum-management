-- Course Units: Inline section headers that can be placed between lessons
-- Units are draggable separators that appear in admin course view, teacher course view, and Course Scope & Sequence PDFs

CREATE TABLE IF NOT EXISTS public.course_units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (title ~* '^UNIT \['),
  display_order FLOAT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster lookups by course
CREATE INDEX IF NOT EXISTS idx_course_units_course ON public.course_units(course_id);
CREATE INDEX IF NOT EXISTS idx_course_units_order ON public.course_units(course_id, display_order);

-- Add display_order to lessons table (for unified ordering with units)
ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS display_order FLOAT;

-- Initialize display_order from lesson_number for existing lessons
UPDATE public.lessons SET display_order = lesson_number::float WHERE display_order IS NULL;

-- RLS Policies
ALTER TABLE public.course_units ENABLE ROW LEVEL SECURITY;

-- Everyone can read units (needed for teacher view)
CREATE POLICY "Anyone can view units"
  ON public.course_units
  FOR SELECT USING (true);

-- Only admins can insert/update/delete units
CREATE POLICY "Admins can manage units"
  ON public.course_units
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to course_units
DROP TRIGGER IF EXISTS update_course_units_updated_at ON public.course_units;
CREATE TRIGGER update_course_units_updated_at
  BEFORE UPDATE ON public.course_units
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
