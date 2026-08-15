-- Migration: 025_increase_version_limit.sql
-- Increases the maximum number of active versions per lesson from 3 to 10

-- Update the trigger function to allow 10 versions instead of 3
CREATE OR REPLACE FUNCTION check_version_limit()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT COUNT(*) FROM public.lesson_versions
      WHERE lesson_id = NEW.lesson_id AND deleted_at IS NULL) >= 10 THEN
    RAISE EXCEPTION 'Maximum of 10 active versions allowed per lesson';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
