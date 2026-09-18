-- Access expiration for active teachers
-- Adds a per-profile date when an active teacher's access should end.
-- Past dates auto-transition the profile to enrollment_status='inactive'
-- via the same gating that handles trial expiry.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS access_ends_at TIMESTAMPTZ;

-- Backfill: any active teacher without an expiration date is set to
-- Dec 31, 2027. Trial/inactive teachers are not backfilled (they can
-- still receive an access_ends_at when admin promotes them to active).
UPDATE public.profiles
SET access_ends_at = '2027-12-31 00:00:00+00'::timestamptz
WHERE enrollment_status = 'active' AND access_ends_at IS NULL;

-- Partial index for queries that need to scan access-expiring profiles
-- (e.g., "who's expiring in the next 30 days").
CREATE INDEX IF NOT EXISTS idx_profiles_access_ends_at
  ON public.profiles (access_ends_at)
  WHERE access_ends_at IS NOT NULL;
