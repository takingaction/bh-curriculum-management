-- Lesson PDFs storage table
CREATE TABLE lesson_pdfs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID REFERENCES lessons(id) ON DELETE CASCADE UNIQUE,
  storage_path TEXT NOT NULL,
  file_size INTEGER,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  generated_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE lesson_pdfs ENABLE ROW LEVEL SECURITY;

-- Admins can insert/update
CREATE POLICY "Admins can manage lesson PDFs" ON lesson_pdfs
  FOR ALL USING (
    auth.uid() IN (
      SELECT user_id FROM profiles WHERE role = 'admin'
    )
  );

-- Authenticated users can read
CREATE POLICY "Users can read lesson PDFs" ON lesson_pdfs
  FOR SELECT USING (auth.uid() IS NOT NULL);
