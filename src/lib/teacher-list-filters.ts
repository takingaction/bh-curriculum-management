export interface TeacherFilters {
  status: string;        // "" | "active" | "trial" | "inactive"
  role: string;          // "" | "teacher" | "admin"
  disciplines: string[]; // []
  search: string;        // raw user input (not debounced)
  page: number;          // 1+
}

export const VALID_STATUS = ["active", "trial", "inactive"] as const;
export const VALID_ROLES = ["teacher", "admin"] as const;
export const VALID_DISCIPLINES = ["N/A", "MUSIC", "THEATRE", "DANCE"] as const;

export const DEFAULT_FILTERS: TeacherFilters = {
  status: "",
  role: "",
  disciplines: [],
  search: "",
  page: 1,
};

export const readFiltersFromUrl = (sp: URLSearchParams): TeacherFilters => {
  const status = sp.get("status") || "";
  const role = sp.get("role") || "";
  const disciplines = sp
    .getAll("discipline")
    .filter((d): d is string => (VALID_DISCIPLINES as readonly string[]).includes(d));
  const search = sp.get("search") || "";
  const pageParam = parseInt(sp.get("page") || "1", 10);
  const page = Number.isFinite(pageParam) && pageParam >= 1 ? pageParam : 1;

  return {
    status: (VALID_STATUS as readonly string[]).includes(status) ? status : "",
    role: (VALID_ROLES as readonly string[]).includes(role) ? role : "",
    disciplines,
    search,
    page,
  };
};

export const writeFiltersToUrl = (filters: TeacherFilters): URLSearchParams => {
  const sp = new URLSearchParams();
  if (filters.status) sp.set("status", filters.status);
  if (filters.role) sp.set("role", filters.role);
  filters.disciplines.forEach((d) => sp.append("discipline", d));
  if (filters.search) sp.set("search", filters.search);
  if (filters.page > 1) sp.set("page", String(filters.page));
  return sp;
};
