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
