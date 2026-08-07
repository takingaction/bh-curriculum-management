-- Migration: 024_lesson_versions.sql
-- Creates table for AI-generated lesson versions with PDF support

-- Lesson versions table for AI-modified content
CREATE TABLE IF NOT EXISTS lesson_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  version_name TEXT NOT NULL DEFAULT 'Untitled Version',
  content JSONB NOT NULL,  -- { field_name: { html: string, original_length: number } }
  modification_reason TEXT CHECK (modification_reason IN ('duration', 'special_needs', 'materials', 'venue')),
  created_by UUID REFERENCES profiles(id),
  is_approved BOOLEAN DEFAULT false,
  pdf_storage_path TEXT,
  pdf_generated_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(lesson_id, version_number)
);

-- Index for querying active versions per lesson
CREATE INDEX IF NOT EXISTS idx_lesson_versions_active
  ON lesson_versions(lesson_id)
  WHERE deleted_at IS NULL;

-- Index for user's versions
CREATE INDEX IF NOT EXISTS idx_lesson_versions_created_by
  ON lesson_versions(created_by)
  WHERE deleted_at IS NULL;

-- Trigger to enforce max 3 active versions per lesson
CREATE OR REPLACE FUNCTION check_version_limit()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT COUNT(*) FROM lesson_versions
      WHERE lesson_id = NEW.lesson_id AND deleted_at IS NULL) >= 3 THEN
    RAISE EXCEPTION 'Maximum of 3 active versions allowed per lesson';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_version_limit ON lesson_versions;
CREATE TRIGGER enforce_version_limit
  BEFORE INSERT ON lesson_versions
  FOR EACH ROW EXECUTE FUNCTION check_version_limit();

-- RLS Policies
ALTER TABLE lesson_versions ENABLE ROW LEVEL SECURITY;

-- Users can manage their own versions (CRUD)
CREATE POLICY "Users manage own versions"
  ON lesson_versions FOR ALL
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

-- Admins can view all versions
CREATE POLICY "Admins read all versions"
  ON lesson_versions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- PDF usage tracking for weekly limits
CREATE TABLE IF NOT EXISTS lesson_version_pdf_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,  -- Monday of the week
  pdf_count INTEGER DEFAULT 0,
  UNIQUE(user_id, week_start)
);

-- Index for quick lookup
CREATE INDEX IF NOT EXISTS idx_pdf_usage_user_week
  ON lesson_version_pdf_usage(user_id, week_start);

-- RLS for PDF usage
ALTER TABLE lesson_version_pdf_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own PDF usage"
  ON lesson_version_pdf_usage FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Storage bucket for version PDFs (needs to be created separately in Supabase dashboard)
-- Or via CLI: supabase storage create lesson-version-pdfs
