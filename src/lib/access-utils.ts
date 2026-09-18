export const DEFAULT_ACCESS_ENDS_AT = "2027-12-31T00:00:00.000Z";

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
