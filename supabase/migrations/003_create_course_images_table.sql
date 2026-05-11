-- Create course_images table to track all images per course
CREATE TABLE IF NOT EXISTS public.course_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  public_url TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.course_images ENABLE ROW LEVEL SECURITY;

-- RLS policy: admins full access
CREATE POLICY "Admins manage course_images" ON public.course_images FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- RLS policy: authenticated users can read (for media library)
CREATE POLICY "Users read course_images" ON public.course_images FOR SELECT USING (
  auth.role() = 'authenticated'
);
