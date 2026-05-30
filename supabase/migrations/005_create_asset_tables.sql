-- Create asset_categories table
CREATE TABLE IF NOT EXISTS public.asset_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create assets table
CREATE TABLE IF NOT EXISTS public.assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID REFERENCES public.asset_categories(id) ON DELETE SET NULL,
  filename TEXT NOT NULL,
  display_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  public_url TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size BIGINT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create lesson_assets junction table
CREATE TABLE IF NOT EXISTS public.lesson_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  asset_id UUID NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(lesson_id, asset_id)
);

-- Enable RLS
ALTER TABLE public.asset_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_assets ENABLE ROW LEVEL SECURITY;

-- RLS policies for asset_categories: admins full access
CREATE POLICY "Admins manage asset_categories" ON public.asset_categories FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- RLS policies for assets: admins full access, authenticated users can read
CREATE POLICY "Admins manage assets" ON public.assets FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Users read assets" ON public.assets FOR SELECT USING (
  auth.role() = 'authenticated'
);

-- RLS policies for lesson_assets: admins full access, authenticated users can read
CREATE POLICY "Admins manage lesson_assets" ON public.lesson_assets FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Users read lesson_assets" ON public.lesson_assets FOR SELECT USING (
  auth.role() = 'authenticated'
);

-- Insert default categories
INSERT INTO public.asset_categories (name, sort_order) VALUES
  ('Drumming Materials', 1),
  ('General Dance', 2),
  ('General Music', 3),
  ('General Theatre', 4),
  ('Recorder Materials', 5),
  ('Ukulele Materials', 6),
  ('Voice Materials', 7)
ON CONFLICT DO NOTHING;
