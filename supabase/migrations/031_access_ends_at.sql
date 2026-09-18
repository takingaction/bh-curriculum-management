-- Access expiration for active teachers
-- Adds a per-profile date when an active teacher's access should end.
-- Past dates auto-transition the profile to enrollment_status='inactive'
-- via the same gating that handles trial expiry.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS access_ends_at TIMESTAMPTZ;

-- Backfill: any active teacher without an expiration date is set to
-- Dec 31, 2027 at noon UTC. Storing at noon (rather than midnight)
-- keeps the date on Dec 31 in every timezone — midnight UTC renders as
-- Dec 30 in any negative-offset timezone.
UPDATE public.profiles
SET access_ends_at = '2027-12-31 12:00:00+00'::timestamptz
WHERE enrollment_status = 'active' AND access_ends_at IS NULL;

-- Corrective: shift existing rows that were stored at midnight UTC so
-- they render correctly in all timezones. Only affects rows that are
-- exactly on the affected date and time.
UPDATE public.profiles
SET access_ends_at = '2027-12-31 12:00:00+00'::timestamptz
WHERE access_ends_at = '2027-12-31 00:00:00+00'::timestamptz;

-- Partial index for queries that need to scan access-expiring profiles
-- (e.g., "who's expiring in the next 30 days").
CREATE INDEX IF NOT EXISTS idx_profiles_access_ends_at
  ON public.profiles (access_ends_at)
  WHERE access_ends_at IS NOT NULL;
