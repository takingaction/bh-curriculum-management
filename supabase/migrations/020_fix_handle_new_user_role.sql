-- Fix handle_new_user trigger to default to 'teacher' role
-- Migration 004 incorrectly set this to 'admin', which allowed
-- magic link signups to become admins via the handle_new_user trigger

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role)
  VALUES (new.id, new.email, 'teacher');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
