-- Add summary column to courses table
ALTER TABLE public.courses ADD COLUMN summary TEXT;

-- Create course_assets junction table
CREATE TABLE IF NOT EXISTS public.course_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  asset_id UUID NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(course_id, asset_id)
);

-- Enable RLS
ALTER TABLE public.course_assets ENABLE ROW LEVEL SECURITY;

-- RLS policies for course_assets
CREATE POLICY "Admins manage course_assets" ON public.course_assets FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Users read course_assets" ON public.course_assets FOR SELECT USING (
  auth.role() = 'authenticated'
);
