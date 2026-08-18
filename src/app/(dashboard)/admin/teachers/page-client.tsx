"use client";

import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { BulkDeleteModal } from "@/components/bulk-delete-modal";
import { Search, X, Trash2 } from "lucide-react";

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
}

export default function TeachersPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[#2d2d2d]">Teachers</h2>
          <p className="text-[#666666]">Manage teacher accounts and course access</p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/teachers/onboard">
            <Button className="bg-[#0d7377] hover:bg-[#0a5c5f] text-white">
              Onboard New Teacher
            </Button>
          </Link>
          <Link href="/admin/teachers/import">
            <Button variant="outline" className="border-[#0d7377] text-[#0d7377] hover:bg-[#0d7377] hover:text-white">
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
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pendingStatusChanges, setPendingStatusChanges] = useState<Map<string, string>>(new Map());
  const [globalStatus, setGlobalStatus] = useState<string>("");
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    fetchTeachers();
  }, []);

  async function fetchTeachers() {
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();

      const { data: profiles } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      const teachersWithNames = (profiles || []).map((teacher) => ({
        ...teacher,
        full_name: teacher.full_name || [teacher.first_name, teacher.last_name].filter(Boolean).join(" ") || null,
      }));

      setTeachers(teachersWithNames);
    } catch (error) {
      console.error("Failed to fetch teachers:", error);
    } finally {
      setLoading(false);
    }
  }

  const filteredTeachers = useMemo(() => {
    if (!searchQuery.trim()) return teachers;
    const query = searchQuery.toLowerCase();
    return teachers.filter((teacher) => {
      const name = teacher.full_name || [teacher.first_name, teacher.last_name].filter(Boolean).join(" ");
      const email = teacher.email || "";
      return (
        name.toLowerCase().includes(query) ||
        email.toLowerCase().includes(query)
      );
    });
  }, [teachers, searchQuery]);

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
    if (selectedIds.size === filteredTeachers.length) {
      setSelectedIds(new Set());
      setPendingStatusChanges(new Map());
      setGlobalStatus("");
    } else {
      setSelectedIds(new Set(filteredTeachers.map((t) => t.id)));
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

  const handleClearSelection = () => {
    setSelectedIds(new Set());
    setPendingStatusChanges(new Map());
    setGlobalStatus("");
  };

  const handleBulkSave = async () => {
    if (pendingStatusChanges.size === 0) return;

    setSaving(true);
    setSaveError("");

    try {
      const updates = Array.from(pendingStatusChanges.entries()).map(([id, enrollment_status]) => ({
        id,
        enrollment_status,
      }));

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
          if (newStatus !== undefined) {
            return {
              ...teacher,
              enrollment_status: newStatus,
            };
          }
          return teacher;
        })
      );

      setPendingStatusChanges(new Map());
      setGlobalStatus("");
      setSelectedIds(new Set());
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
    setGlobalStatus("");
  };

  if (loading) {
    return <div className="text-center py-8 text-[#666666]">Loading teachers...</div>;
  }

  const hasUnsavedChanges = pendingStatusChanges.size > 0;

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
      `}</style>

      <Card className="border-[#e5e5e0] shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-[#2d2d2d]">All Teachers ({teachers.length})</CardTitle>
          <div className="relative mt-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-10 pl-10 pr-10 border border-[#e5e5e0] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#0d7377] focus:border-transparent"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
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
          {filteredTeachers.length > 0 ? (
            <Table className="teachers-table">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === filteredTeachers.length && filteredTeachers.length > 0}
                      onChange={handleSelectAll}
                      className="h-4 w-4 rounded border-gray-300 text-[#0d7377] focus:ring-[#0d7377]"
                    />
                  </TableHead>
                  <TableHead className="name-cell">Name</TableHead>
                  <TableHead className="email-cell">Email</TableHead>
                  <TableHead className="w-24">Discipline</TableHead>
                  <TableHead className="access-cell">Access</TableHead>
                  <TableHead className="w-32">Status</TableHead>
                  <TableHead className="w-20">Role</TableHead>
                  <TableHead className="w-20">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTeachers.map((teacher) => {
                  const isSelected = selectedIds.has(teacher.id);
                  const pendingStatus = pendingStatusChanges.get(teacher.id);
                  const displayStatus = pendingStatus ?? teacher.enrollment_status ?? "trial";
                  const hasChanged = pendingStatus !== undefined && pendingStatus !== teacher.enrollment_status;

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
          ) : searchQuery ? (
            <p className="text-[#666666] text-center py-8">
              No teachers found matching &quot;{searchQuery}&quot;
            </p>
          ) : (
            <p className="text-[#666666] text-center py-8">No teachers found.</p>
          )}
        </CardContent>
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
