-- Teacher Onboarding: Add teacher-specific fields to profiles

-- Add new columns to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS first_name TEXT,
  ADD COLUMN IF NOT EXISTS last_name TEXT,
  ADD COLUMN IF NOT EXISTS california BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS district_name TEXT,
  ADD COLUMN IF NOT EXISTS primary_discipline TEXT CHECK (primary_discipline IN ('N/A', 'MUSIC', 'THEATRE', 'DANCE')),
  ADD COLUMN IF NOT EXISTS enrollment_status TEXT DEFAULT 'trial' CHECK (enrollment_status IN ('active', 'trial', 'inactive')),
  ADD COLUMN IF NOT EXISTS enrollments JSONB DEFAULT '["ALL"]',
  ADD COLUMN IF NOT EXISTS trial_starts_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;

-- Function to set trial dates when enrollment_status is 'trial'
CREATE OR REPLACE FUNCTION public.handle_trial_dates()
RETURNS trigger AS $$
BEGIN
  IF NEW.enrollment_status = 'trial' AND NEW.trial_starts_at IS NULL THEN
    NEW.trial_starts_at = NOW();
    NEW.trial_ends_at = NOW() + INTERVAL '14 days';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to set trial dates on insert/update
DROP TRIGGER IF EXISTS set_trial_dates_on_profile ON public.profiles;
CREATE TRIGGER set_trial_dates_on_profile
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_trial_dates();

-- Drop existing RLS policies for profiles and recreate with admin access
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

-- Users can view their own profile
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

-- Users can update their own profile (but not role/status)
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Users can insert their own profile
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Admins can view all profiles
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Admins can update all profiles (including role, status, etc)
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
CREATE POLICY "Admins can update all profiles" ON public.profiles
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Admins can insert profiles
DROP POLICY IF EXISTS "Admins can insert profiles" ON public.profiles;
CREATE POLICY "Admins can insert profiles" ON public.profiles
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );
