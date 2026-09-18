-- Snap trial_ends_at to noon UTC on the target date so the rendered
-- expiry matches the calendar day the admin expects in every timezone.
-- Matches the JS-side utcNoonInDaysFromNow(14) helper.

CREATE OR REPLACE FUNCTION public.handle_trial_dates()
RETURNS trigger AS $$
BEGIN
  IF NEW.enrollment_status = 'trial' AND NEW.trial_starts_at IS NULL THEN
    NEW.trial_starts_at = NOW();
    NEW.trial_ends_at = (DATE_TRUNC('day', NOW() + INTERVAL '14 days') + INTERVAL '12 hours');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
