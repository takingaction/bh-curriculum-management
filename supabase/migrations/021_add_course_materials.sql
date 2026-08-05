-- Add materials field to courses table
ALTER TABLE public.courses
ADD COLUMN IF NOT EXISTS materials TEXT;