-- Add pdf_image_url column for PDF title page hero image
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS pdf_image_url TEXT;
