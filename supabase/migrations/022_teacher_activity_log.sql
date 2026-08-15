-- Migration: 022_teacher_activity_log.sql
-- Creates table for tracking teacher activity (logins, page views)

-- Activity log table
CREATE TABLE IF NOT EXISTS user_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('login', 'view_lesson', 'view_course')),
  resource_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_activity_user_date ON user_activity_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_created_at ON user_activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_action ON user_activity_log(action);

-- RLS Policies (admin only can read, service role can insert)
ALTER TABLE user_activity_log ENABLE ROW LEVEL SECURITY;

-- Admin and service role full access
CREATE POLICY "Admin full access to user_activity_log"
  ON user_activity_log FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (true);

-- Function to log activity (can be called directly or via trigger)
CREATE OR REPLACE FUNCTION log_user_activity(
  p_user_id UUID,
  p_action TEXT,
  p_resource_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO public.user_activity_log (user_id, action, resource_id)
  VALUES (p_user_id, p_action, p_resource_id)
  RETURNING id INTO v_log_id;
  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get unique active days for a user in a date range
CREATE OR REPLACE FUNCTION get_active_days(p_user_id UUID, p_start_date TIMESTAMPTZ, p_end_date TIMESTAMPTZ)
RETURNS SETOF DATE AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT DATE(created_at)::DATE
  FROM public.user_activity_log
  WHERE user_id = p_user_id
    AND created_at >= p_start_date
    AND created_at < p_end_date
  ORDER BY DATE(created_at)::DATE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
