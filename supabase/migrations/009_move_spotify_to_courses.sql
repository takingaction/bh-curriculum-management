-- Move Spotify from lessons to courses

-- Add Spotify embed code to courses table
ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS spotify_embed_code TEXT;

COMMENT ON COLUMN public.courses.spotify_embed_code IS 'Embedded Spotify playlist iframe code for all lessons in this course';

-- Remove Spotify embed code from lessons table
ALTER TABLE public.lessons
  DROP COLUMN IF EXISTS spotify_embed_code;