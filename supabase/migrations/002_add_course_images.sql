-- Add image_url column to courses table
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Create storage bucket for course images (run in Supabase dashboard or via API)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('course-images', 'course-images', true);

-- Create storage policy for public access to course images
-- CREATE POLICY "Public can view course images" ON storage.objects
-- FOR SELECT USING (bucket_id = 'course-images');

-- CREATE POLICY "Authenticated users can upload course images" ON storage.objects
-- FOR INSERT WITH CHECK (bucket_id = 'course-images' AND auth.role() = 'authenticated');