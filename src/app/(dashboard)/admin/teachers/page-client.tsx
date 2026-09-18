"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { BulkDeleteModal } from "@/components/bulk-delete-modal";
import { Search, X, Trash2 } from "lucide-react";
import { isoToLocalDateInput, isoToLocalDateDisplay, localDateInputToUtcNoon } from "@/lib/access-utils";
import {
  readFiltersFromUrl,
  writeFiltersToUrl,
} from "@/lib/teacher-list-filters";
import { MultiSelectPopover } from "@/components/multi-select-popover";

interface Teacher {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  role: string;
  enrollment_status: string | null;
  primary_discipline: string | null;
  district_name: string | null;
  created_at: string;
  enrollments: string[] | null;
  access_ends_at: string | null;
}

const isAccessExpiredForActive = (teacher: Teacher): boolean => {
  return (
    teacher.enrollment_status === "active" &&
    !!teacher.access_ends_at &&
    new Date(teacher.access_ends_at) < new Date()
  );
};

export default function TeachersPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-[#2d2d2d]">Teachers</h2>
          <p className="text-[#666666]">Manage teacher accounts and course access</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <Link href="/admin/teachers/onboard" className="w-full sm:w-auto">
            <Button className="w-full bg-[#0d7377] hover:bg-[#0a5c5f] text-white">
              Onboard New Teacher
            </Button>
          </Link>
          <Link href="/admin/teachers/import" className="w-full sm:w-auto">
            <Button variant="outline" className="w-full border-[#0d7377] text-[#0d7377] hover:bg-[#0d7377] hover:text-white">
              Import from CSV
            </Button>
          </Link>
        </div>
      </div>

      <TeacherList />
    </div>
  );
}

function TeacherList() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const hydratedFromUrl = useRef(false);

  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Filter state hydrated from URL (single source of truth)
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [roleFilter, setRoleFilter] = useState<string>("");
  const [disciplines, setDisciplines] = useState<string[]>([]);
  const [page, setPage] = useState(1);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pendingStatusChanges, setPendingStatusChanges] = useState<Map<string, string>>(new Map());
  const [pendingAccessDateChanges, setPendingAccessDateChanges] = useState<Map<string, string | null>>(new Map());
  const [globalStatus, setGlobalStatus] = useState<string>("");
  const [globalAccessDate, setGlobalAccessDate] = useState<string>("");
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const pageSize = 50;

  // Hydrate state from URL on first mount
  useEffect(() => {
    const initial = readFiltersFromUrl(searchParams);
    setStatusFilter(initial.status);
    setRoleFilter(initial.role);
    setDisciplines(initial.disciplines);
    setSearchInput(initial.search);
    setDebouncedSearch(initial.search);
    setPage(initial.page);
    hydratedFromUrl.current = true;
  }, [searchParams]);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchInput), 250);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Reset to page 1 when filters/search change
  useEffect(() => {
    if (!hydratedFromUrl.current) return;
    setPage(1);
  }, [statusFilter, roleFilter, disciplines, debouncedSearch]);

  // Write filter state back to URL whenever it changes
  useEffect(() => {
    if (!hydratedFromUrl.current) return;
    const sp = writeFiltersToUrl({
      status: statusFilter,
      role: roleFilter,
      disciplines,
      search: debouncedSearch,
      page,
    });
    const qs = sp.toString();
    const target = qs ? `?${qs}` : "/admin/teachers";
    router.replace(target, { scroll: false });
  }, [statusFilter, roleFilter, disciplines, debouncedSearch, page, router]);

  // Fetch teachers when filters/page change
  const loadTeachers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (roleFilter) params.set("role", roleFilter);
      disciplines.forEach((d) => params.append("discipline", d));
      if (debouncedSearch) params.set("search", debouncedSearch);
      params.set("limit", String(pageSize));
      params.set("offset", String((page - 1) * pageSize));

      const res = await fetch(`/api/admin/teachers?${params}`);
      const data = await res.json();
      if (data.error) {
        console.error("Failed to fetch teachers:", data.error);
        return;
      }
      const withNames = (data.profiles || []).map((teacher: Teacher) => ({
        ...teacher,
        full_name:
          teacher.full_name ||
          [teacher.first_name, teacher.last_name].filter(Boolean).join(" ") ||
          null,
      }));
      setTeachers(withNames);
      setTotal(data.total ?? 0);
    } catch (error) {
      console.error("Failed to fetch teachers:", error);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, roleFilter, disciplines, debouncedSearch, page]);

  useEffect(() => {
    loadTeachers();
  }, [loadTeachers]);

  // Stable ref so bulk-save handlers can refresh the current page after writes.
  const refreshRef = useRef(loadTeachers);
  useEffect(() => {
    refreshRef.current = loadTeachers;
  });

  const getName = (teacher: Teacher) => {
    if (teacher.full_name) return teacher.full_name;
    if (teacher.first_name || teacher.last_name) {
      return [teacher.first_name, teacher.last_name].filter(Boolean).join(" ");
    }
    return "-";
  };

  const getStatusBadge = (status: string | null) => {
    let className = "text-white";
    if (status === "active") {
      className = "bg-green-600 text-white";
    } else if (status === "trial") {
      className = "bg-blue-600 text-white";
    } else if (status === "inactive") {
      className = "bg-red-600 text-white";
    }
    return (
      <Badge className={className}>
        {status || "unknown"}
      </Badge>
    );
  };

  const formatEnrollments = (enrollments: string[] | null): string => {
    if (!enrollments || enrollments.length === 0) return "None";
    if (enrollments.includes("ALL")) return "All";

    const disciplines = new Set<string>();
    const gradeOnlyEntries: { discipline: string; grade: string }[] = [];

    enrollments.forEach((e) => {
      if (e.includes("_GRADE_")) {
        const [discipline, grade] = e.split("_GRADE_");
        gradeOnlyEntries.push({ discipline, grade });
      } else {
        disciplines.add(e);
      }
    });

    const parts: string[] = [];
    disciplines.forEach((d) => parts.push(d));
    gradeOnlyEntries.forEach(({ discipline, grade }) => {
      if (!disciplines.has(discipline)) {
        parts.push(`${discipline} ${grade}`);
      }
    });

    return parts.join(", ") || "None";
  };

  const handleSelectAll = () => {
    if (selectedIds.size === teachers.length) {
      setSelectedIds(new Set());
      setPendingStatusChanges(new Map());
      setPendingAccessDateChanges(new Map());
      setGlobalStatus("");
      setGlobalAccessDate("");
    } else {
      setSelectedIds(new Set(teachers.map((t) => t.id)));
    }
  };

  const handleSelectOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
      setPendingStatusChanges((prev) => {
        const updated = new Map(prev);
        updated.delete(id);
        return updated;
      });
      setPendingAccessDateChanges((prev) => {
        const updated = new Map(prev);
        updated.delete(id);
        return updated;
      });
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const handleStatusChange = (teacherId: string, status: string) => {
    setPendingStatusChanges((prev) => {
      const next = new Map(prev);
      next.set(teacherId, status);
      return next;
    });
    setGlobalStatus("");
  };

  const handleGlobalStatusChange = (status: string) => {
    setGlobalStatus(status);
    if (status) {
      setPendingStatusChanges((prev) => {
        const next = new Map(prev);
        selectedIds.forEach((id) => next.set(id, status));
        return next;
      });
    }
  };

  const handleAccessDateChange = (teacherId: string, date: string) => {
    setPendingAccessDateChanges((prev) => {
      const next = new Map(prev);
      // Empty string = clear; non-empty = noon-UTC ISO so the date
      // renders the same in every timezone (see access-utils.ts).
      next.set(teacherId, date === "" ? null : localDateInputToUtcNoon(date));
      return next;
    });
    setGlobalAccessDate("");
  };

  const handleGlobalAccessDateChange = (date: string) => {
    setGlobalAccessDate(date);
    setPendingAccessDateChanges((prev) => {
      const next = new Map(prev);
      selectedIds.forEach((id) => {
        if (date === "") {
          next.set(id, null);
        } else {
          next.set(id, localDateInputToUtcNoon(date));
        }
      });
      return next;
    });
  };

  const handleClearSelection = () => {
    setSelectedIds(new Set());
    setPendingStatusChanges(new Map());
    setPendingAccessDateChanges(new Map());
    setGlobalStatus("");
    setGlobalAccessDate("");
  };

  const handleBulkSave = async () => {
    if (pendingStatusChanges.size === 0 && pendingAccessDateChanges.size === 0) return;

    setSaving(true);
    setSaveError("");

    try {
      // Merge status + access date changes keyed by teacher id.
      const idsWithChanges = new Set<string>([
        ...pendingStatusChanges.keys(),
        ...pendingAccessDateChanges.keys(),
      ]);

      const updates = Array.from(idsWithChanges).map((id) => {
        const update: {
          id: string;
          enrollment_status?: string;
          access_ends_at?: string | null;
        } = { id };
        if (pendingStatusChanges.has(id)) {
          update.enrollment_status = pendingStatusChanges.get(id);
        }
        if (pendingAccessDateChanges.has(id)) {
          update.access_ends_at = pendingAccessDateChanges.get(id) ?? null;
        }
        return update;
      });

      const res = await fetch("/api/admin/teachers/bulk", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update teachers");
      }

      setTeachers((prev) =>
        prev.map((teacher) => {
          const newStatus = pendingStatusChanges.get(teacher.id);
          const newAccessDate = pendingAccessDateChanges.get(teacher.id);
          const updated = { ...teacher };
          if (newStatus !== undefined) updated.enrollment_status = newStatus;
          if (newAccessDate !== undefined) updated.access_ends_at = newAccessDate;
          return updated;
        })
      );

      setPendingStatusChanges(new Map());
      setPendingAccessDateChanges(new Map());
      setGlobalStatus("");
      setGlobalAccessDate("");
      setSelectedIds(new Set());
      // Re-fetch the current page so server-side state (status + access_ends_at)
      // is reflected without a manual reload. Cross-page selections update on next visit.
      refreshRef.current?.();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to save changes";
      setSaveError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleBulkDelete = async (ids: string[]) => {
    const res = await fetch("/api/admin/teachers/bulk", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Failed to delete teachers");
    }
    setTeachers((prev) => prev.filter((t) => !ids.includes(t.id)));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.delete(id));
      return next;
    });
    setPendingStatusChanges(new Map());
    setPendingAccessDateChanges(new Map());
    setGlobalStatus("");
    setGlobalAccessDate("");
    // Refetch current page so the total count updates after a delete.
    refreshRef.current?.();
  };

  if (loading) {
    return <div className="text-center py-8 text-[#666666]">Loading teachers...</div>;
  }

  const hasUnsavedChanges = pendingStatusChanges.size > 0 || pendingAccessDateChanges.size > 0;

  return (
    <>
      <style jsx global>{`
        .teachers-table {
          table-layout: fixed;
          width: 100%;
        }
        .teachers-table .name-cell {
          max-width: 200px;
          word-wrap: break-word;
          white-space: normal;
        }
        .teachers-table .email-cell {
          max-width: 200px;
          word-wrap: break-word;
          white-space: normal;
        }
        .teachers-table .access-cell {
          max-width: 150px;
          word-wrap: break-word;
          white-space: normal;
        }
        .teachers-table .access-expires-cell {
          max-width: 130px;
          word-wrap: break-word;
          white-space: normal;
        }
      `}</style>

      <Card className="border-[#e5e5e0] shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-[#2d2d2d]">All Teachers ({total})</CardTitle>
          <div className="flex flex-col md:flex-row md:items-start gap-3 mt-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name or email..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full h-10 pl-10 pr-10 border border-[#e5e5e0] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#0d7377] focus:border-transparent"
              />
              {searchInput && (
                <button
                  onClick={() => setSearchInput("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-10 px-3 border border-[#e5e5e0] rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#0d7377] md:w-auto"
              aria-label="Filter by status"
            >
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="trial">Trial</option>
              <option value="inactive">Inactive</option>
            </select>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="h-10 px-3 border border-[#e5e5e0] rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#0d7377] md:w-auto"
              aria-label="Filter by role"
            >
              <option value="">All roles</option>
              <option value="teacher">Teacher</option>
              <option value="admin">Admin</option>
            </select>
            <MultiSelectPopover
              label="Discipline"
              options={[
                { value: "N/A", label: "N/A" },
                { value: "MUSIC", label: "Music" },
                { value: "THEATRE", label: "Theatre" },
                { value: "DANCE", label: "Dance" },
              ]}
              selected={disciplines}
              onChange={setDisciplines}
            />
          </div>
        </CardHeader>

        {selectedIds.size > 0 && (
          <div className="px-6 pb-4">
            <div className="flex flex-wrap items-center gap-3 p-3 bg-gray-50 rounded-lg border border-[#e5e5e0]">
              <div className="flex-1 min-w-[150px] text-sm text-[#666666]">
                {selectedIds.size} teacher{selectedIds.size !== 1 ? "s" : ""} selected
                {hasUnsavedChanges && <span className="ml-2 text-amber-600">(unsaved changes)</span>}
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">Set all to:</span>
                <select
                  value={globalStatus}
                  onChange={(e) => handleGlobalStatusChange(e.target.value)}
                  className="h-8 px-2 text-sm border border-[#e5e5e0] rounded focus:outline-none focus:ring-1 focus:ring-[#0d7377]"
                >
                  <option value="">Choose...</option>
                  <option value="trial">Trial</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">Access expires:</span>
                <input
                  type="date"
                  value={globalAccessDate}
                  onChange={(e) => handleGlobalAccessDateChange(e.target.value)}
                  className="h-8 px-2 text-sm border border-[#e5e5e0] rounded focus:outline-none focus:ring-1 focus:ring-[#0d7377]"
                  aria-label="Set access expiration for all selected teachers"
                />
                {globalAccessDate && (
                  <button
                    type="button"
                    onClick={() => handleGlobalAccessDateChange("")}
                    className="text-xs text-gray-500 hover:text-gray-700"
                  >
                    clear
                  </button>
                )}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={handleBulkSave}
                disabled={!hasUnsavedChanges || saving}
                className="border-[#0d7377] text-[#0d7377] hover:bg-[#0d7377] hover:text-white"
              >
                {saving ? "Saving..." : "Save Changes"}
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setDeleteModalOpen(true)}
                className="border-red-600 text-red-600 hover:bg-red-600 hover:text-white"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Delete
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearSelection}
                className="text-gray-500"
              >
                Clear
              </Button>
            </div>

            {saveError && (
              <div className="mt-2 p-2 text-sm text-red-600 bg-red-50 rounded-md">
                {saveError}
              </div>
            )}
          </div>
        )}

        <CardContent className="pt-0">
          {teachers.length > 0 ? (
            <>
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <Table className="teachers-table">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <input
                          type="checkbox"
                          checked={selectedIds.size === teachers.length && teachers.length > 0}
                          onChange={handleSelectAll}
                          className="h-4 w-4 rounded border-gray-300 text-[#0d7377] focus:ring-[#0d7377]"
                        />
                      </TableHead>
                      <TableHead className="name-cell">Name</TableHead>
                      <TableHead className="email-cell">Email</TableHead>
                      <TableHead className="w-24">Discipline</TableHead>
                      <TableHead className="access-cell">Access</TableHead>
                      <TableHead className="access-expires-cell">Access Expires</TableHead>
                      <TableHead className="w-32">Status</TableHead>
                      <TableHead className="w-20">Role</TableHead>
                      <TableHead className="w-20">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {teachers.map((teacher) => {
                      const isSelected = selectedIds.has(teacher.id);
                      const pendingStatus = pendingStatusChanges.get(teacher.id);
                      const displayStatus = pendingStatus ?? teacher.enrollment_status ?? "trial";
                      const hasChanged = pendingStatus !== undefined && pendingStatus !== teacher.enrollment_status;

                      // Effective access_ends_at for this row (pending override or current value)
                      const pendingAccessDate = pendingAccessDateChanges.get(teacher.id);
                      const hasDateChange = pendingAccessDateChanges.has(teacher.id);
                      const effectiveDateIso =
                        pendingAccessDate !== undefined ? pendingAccessDate : teacher.access_ends_at;
                      const effectiveDateOnly = isoToLocalDateInput(effectiveDateIso ?? null);
                      const expired = isAccessExpiredForActive({
                        ...teacher,
                        access_ends_at: effectiveDateIso ?? null,
                      });

                      return (
                        <TableRow key={teacher.id} className={isSelected ? "bg-[#f0fdfa]" : ""}>
                          <TableCell>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleSelectOne(teacher.id)}
                              className="h-4 w-4 rounded border-gray-300 text-[#0d7377] focus:ring-[#0d7377]"
                            />
                          </TableCell>
                          <TableCell className="name-cell font-medium">{getName(teacher)}</TableCell>
                          <TableCell className="email-cell text-[#666666]">{teacher.email}</TableCell>
                          <TableCell className="text-[#666666]">{teacher.primary_discipline || "N/A"}</TableCell>
                          <TableCell className="access-cell text-[#666666]">{formatEnrollments(teacher.enrollments)}</TableCell>
                          <TableCell className="access-expires-cell">
                            {isSelected ? (
                              <div className="flex items-center gap-1">
                                <input
                                  type="date"
                                  value={effectiveDateOnly}
                                  onChange={(e) => handleAccessDateChange(teacher.id, e.target.value)}
                                  className={`h-8 px-2 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-[#0d7377] ${
                                    hasDateChange ? "border-amber-400 bg-amber-50" : "border-[#e5e5e0]"
                                  }`}
                                  aria-label={`Access expiration for ${getName(teacher)}`}
                                />
                                {hasDateChange && (
                                  <button
                                    type="button"
                                    onClick={() => handleAccessDateChange(teacher.id, teacher.access_ends_at ? isoToLocalDateInput(teacher.access_ends_at) : "")}
                                    className="text-xs text-gray-400 hover:text-gray-600"
                                    aria-label="Reset to original date"
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                )}
                              </div>
                            ) : expired ? (
                              <span className="text-sm text-red-600 font-medium">
                                {isoToLocalDateDisplay(teacher.access_ends_at)} (expired)
                              </span>
                            ) : (
                              <span className={`text-sm ${teacher.access_ends_at ? "text-[#666666]" : "text-gray-400"}`}>
                                {isoToLocalDateDisplay(teacher.access_ends_at)}
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            {isSelected ? (
                              <select
                                value={displayStatus}
                                onChange={(e) => handleStatusChange(teacher.id, e.target.value)}
                                className={`w-full h-8 px-2 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-[#0d7377] ${
                                  hasChanged ? "border-amber-400 bg-amber-50" : "border-[#e5e5e0]"
                                }`}
                              >
                                <option value="trial">Trial</option>
                                <option value="active">Active</option>
                                <option value="inactive">Inactive</option>
                              </select>
                            ) : (
                              getStatusBadge(teacher.enrollment_status)
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={teacher.role === "admin" ? "default" : "secondary"}
                              className={teacher.role === "admin" ? "bg-[#0d7377]" : ""}
                            >
                              {teacher.role}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => window.location.href = `/admin/teachers/${teacher.id}`}
                              className="border-[#0d7377] text-[#0d7377] hover:bg-[#0d7377] hover:text-white"
                            >
                              Edit
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile card list */}
              <div className="md:hidden space-y-3">
                {teachers.map((teacher) => {
                  const isSelected = selectedIds.has(teacher.id);
                  const pendingStatus = pendingStatusChanges.get(teacher.id);
                  const displayStatus = pendingStatus ?? teacher.enrollment_status ?? "trial";
                  const hasChanged = pendingStatus !== undefined && pendingStatus !== teacher.enrollment_status;

                  const pendingAccessDate = pendingAccessDateChanges.get(teacher.id);
                  const hasDateChange = pendingAccessDateChanges.has(teacher.id);
                  const effectiveDateIso =
                    pendingAccessDate !== undefined ? pendingAccessDate : teacher.access_ends_at;
                  const effectiveDateOnly = isoToLocalDateInput(effectiveDateIso ?? null);
                  const expired = isAccessExpiredForActive({
                    ...teacher,
                    access_ends_at: effectiveDateIso ?? null,
                  });

                  return (
                    <div
                      key={teacher.id}
                      className={`border border-[#e5e5e0] rounded-lg p-4 space-y-3 ${
                        isSelected ? "bg-[#f0fdfa] border-[#0d7377]" : "bg-white"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleSelectOne(teacher.id)}
                          className="h-4 w-4 mt-1 rounded border-gray-300 text-[#0d7377] focus:ring-[#0d7377]"
                          aria-label={`Select ${getName(teacher)}`}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-[#2d2d2d] truncate">{getName(teacher)}</p>
                          <p className="text-xs text-[#666666] truncate">{teacher.email}</p>
                        </div>
                        {isSelected ? (
                          <select
                            value={displayStatus}
                            onChange={(e) => handleStatusChange(teacher.id, e.target.value)}
                            className={`h-8 px-2 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-[#0d7377] ${
                              hasChanged ? "border-amber-400 bg-amber-50" : "border-[#e5e5e0]"
                            }`}
                            aria-label={`Status for ${getName(teacher)}`}
                          >
                            <option value="trial">Trial</option>
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                          </select>
                        ) : (
                          getStatusBadge(teacher.enrollment_status)
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <div className="text-xs text-gray-500">Discipline</div>
                          <div className="text-[#666666]">{teacher.primary_discipline || "N/A"}</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500">Role</div>
                          <div>
                            <Badge
                              variant={teacher.role === "admin" ? "default" : "secondary"}
                              className={teacher.role === "admin" ? "bg-[#0d7377]" : ""}
                            >
                              {teacher.role}
                            </Badge>
                          </div>
                        </div>
                        <div className="col-span-2">
                          <div className="text-xs text-gray-500">Access</div>
                          <div className="text-[#666666] break-words">{formatEnrollments(teacher.enrollments)}</div>
                        </div>
                        <div className="col-span-2">
                          <div className="text-xs text-gray-500">Access Expires</div>
                          {isSelected ? (
                            <div className="flex items-center gap-1">
                              <input
                                type="date"
                                value={effectiveDateOnly}
                                onChange={(e) => handleAccessDateChange(teacher.id, e.target.value)}
                                className={`h-8 px-2 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-[#0d7377] ${
                                  hasDateChange ? "border-amber-400 bg-amber-50" : "border-[#e5e5e0]"
                                }`}
                                aria-label={`Access expiration for ${getName(teacher)}`}
                              />
                              {hasDateChange && (
                                <button
                                  type="button"
                                  onClick={() => handleAccessDateChange(teacher.id, teacher.access_ends_at ? isoToLocalDateInput(teacher.access_ends_at) : "")}
                                  className="text-xs text-gray-400 hover:text-gray-600"
                                  aria-label="Reset to original date"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              )}
                            </div>
                          ) : expired ? (
                            <div className="text-red-600 font-medium">
                              {isoToLocalDateDisplay(teacher.access_ends_at)} (expired)
                            </div>
                          ) : (
                            <div className={teacher.access_ends_at ? "text-[#666666]" : "text-gray-400"}>
                              {isoToLocalDateDisplay(teacher.access_ends_at)}
                            </div>
                          )}
                        </div>
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.location.href = `/admin/teachers/${teacher.id}`}
                        className="w-full border-[#0d7377] text-[#0d7377] hover:bg-[#0d7377] hover:text-white"
                      >
                        Edit
                       </Button>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <p className="text-[#666666] text-center py-8">No teachers found.</p>
          )}
        </CardContent>

        {total > pageSize && (
          <div className="px-6 py-3 bg-gray-50 border-t border-[#e5e5e0]">
            <div className="hidden md:flex items-center justify-between">
              <div className="text-sm text-[#666666]">
                Showing {((page - 1) * pageSize) + 1} to {Math.min(page * pageSize, total)} of {total} teachers
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page - 1)}
                  disabled={page <= 1}
                >
                  Previous
                </Button>
                {Array.from({ length: Math.min(5, Math.ceil(total / pageSize)) }, (_, i) => {
                  const totalPages = Math.ceil(total / pageSize);
                  let pageNum: number;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (page <= 3) {
                    pageNum = i + 1;
                  } else if (page >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = page - 2 + i;
                  }
                  return (
                    <Button
                      key={pageNum}
                      variant={page === pageNum ? "default" : "outline"}
                      size="sm"
                      onClick={() => setPage(pageNum)}
                      className={page === pageNum ? "bg-[#0d7377] hover:bg-[#0a5c5f]" : ""}
                    >
                      {pageNum}
                    </Button>
                  );
                })}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page + 1)}
                  disabled={page >= Math.ceil(total / pageSize)}
                >
                  Next
                </Button>
              </div>
            </div>
            <div className="md:hidden flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(page - 1)}
                disabled={page <= 1}
              >
                Previous
              </Button>
              <div className="text-sm text-[#666666]">
                Page {page} of {Math.ceil(total / pageSize)}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(page + 1)}
                disabled={page >= Math.ceil(total / pageSize)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>

      <BulkDeleteModal
        open={deleteModalOpen}
        onOpenChange={setDeleteModalOpen}
        teachers={teachers.filter((t) => selectedIds.has(t.id))}
        onConfirm={handleBulkDelete}
      />
    </>
  );
}
