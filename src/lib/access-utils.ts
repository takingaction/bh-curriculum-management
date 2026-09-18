export const DEFAULT_ACCESS_ENDS_AT = "2027-12-31T12:00:00.000Z";

// Convert an ISO timestamp into the YYYY-MM-DD string expected by
// <input type="date">, using the *local* calendar date (not UTC). Without
// this, a stored 2027-12-31T00:00:00Z renders as 2027-12-30 in PT and
// any other timezone west of UTC.
export const isoToLocalDateInput = (iso: string | null | undefined): string => {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

export const isoToLocalDateDisplay = (iso: string | null | undefined): string => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
};

// Convert a YYYY-MM-DD string (from <input type="date">) into a UTC ISO
// timestamp anchored at *noon*. Storing at noon keeps the same calendar
// date in every timezone, so toLocaleDateString renders the date the
// admin actually picked (e.g. 2027-12-31) instead of drifting one day
// earlier in PT or other negative-offset timezones.
export const localDateInputToUtcNoon = (date: string): string => {
  // Defensive: accept only strict YYYY-MM-DD; anything else falls back
  // to the same string so the previous behavior is preserved.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return new Date(date).toISOString();
  }
  return `${date}T12:00:00.000Z`;
};

// For trial defaults like "now + 14 days": snap to noon UTC on the
// target date so the rendered expiry matches the calendar day the
// admin expects regardless of timezone.
export const utcNoonInDaysFromNow = (days: number): string => {
  const target = new Date();
  target.setDate(target.getDate() + days);
  const y = target.getFullYear();
  const m = String(target.getMonth() + 1).padStart(2, "0");
  const day = String(target.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}T12:00:00.000Z`;
};

export const isValidIsoDate = (value: unknown): value is string => {
  if (typeof value !== "string") return false;
  const d = new Date(value);
  return !isNaN(d.getTime());
};

export const oneYearFromNow = (): string => {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString();
};
