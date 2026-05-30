-- Create Supabase storage bucket for curriculum assets
-- This bucket stores PDF, video, and audio files for lessons

-- Insert bucket (run with anon or service role that has bucket permissions)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'curriculum-assets',
  'curriculum-assets',
  true,
  NULL, -- no file size limit (handled by Vercel/Supabase limits)
  ARRAY['application/pdf', 'video/mp4', 'video/quicktime', 'audio/mp4', 'audio/mpeg', 'audio/x-m4a']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  allowed_mime_types = ARRAY['application/pdf', 'video/mp4', 'video/quicktime', 'audio/mp4', 'audio/mpeg', 'audio/x-m4a'];

-- Create storage policies for the bucket

-- Allow authenticated users to read (download) files
CREATE POLICY "Authenticated users can read curriculum-assets"
ON storage.objects
FOR SELECT
USING (bucket_id = 'curriculum-assets');

-- Allow authenticated users to upload files
CREATE POLICY "Authenticated users can upload curriculum-assets"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'curriculum-assets');

-- Allow authenticated users to delete files
CREATE POLICY "Authenticated users can delete curriculum-assets"
ON storage.objects
FOR DELETE
USING (bucket_id = 'curriculum-assets');
