-- Add presentation and Spotify playlist columns to lessons table

ALTER TABLE public.lessons
  ADD COLUMN IF NOT EXISTS presentation_name TEXT,
  ADD COLUMN IF NOT EXISTS presentation_url TEXT,
  ADD COLUMN IF NOT EXISTS spotify_embed_code TEXT;

-- Comments for documentation
COMMENT ON COLUMN public.lessons.presentation_name IS 'Display name for lesson presentation link';
COMMENT ON COLUMN public.lessons.presentation_url IS 'URL for lesson presentation (opens in new tab)';
COMMENT ON COLUMN public.lessons.spotify_embed_code IS 'Embedded Spotify playlist iframe code';