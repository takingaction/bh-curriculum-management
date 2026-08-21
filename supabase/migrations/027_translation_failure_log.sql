CREATE TABLE translation_failures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  lesson_id UUID REFERENCES lessons(id) NOT NULL,
  version_id UUID REFERENCES lesson_versions(id),
  batch_number INT NOT NULL,
  failed_fields TEXT[] NOT NULL,
  error_type TEXT NOT NULL,
  error_message TEXT,
  ai_response_length INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE translation_failures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own failure logs"
  ON translation_failures FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own failure logs"
  ON translation_failures FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can view all failure logs"
  ON translation_failures FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
