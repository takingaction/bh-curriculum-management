"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useRouter } from "next/navigation";
import { AssignCoursesDialog } from "@/components/assign-courses-dialog";
import Link from "next/link";

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
  teacher_assignments?: { count: number }[];
}

export default function TeachersPage() {
  const router = useRouter();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[#2d2d2d]">Teachers</h2>
          <p className="text-[#666666]">Manage teacher accounts and course assignments</p>
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
  const router = useRouter();
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);

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

      const { data: assignments } = await supabase
        .from("teacher_assignments")
        .select("teacher_id");

      const assignmentsByTeacher: Record<string, number> = {};
      (assignments || []).forEach((a) => {
        assignmentsByTeacher[a.teacher_id] = (assignmentsByTeacher[a.teacher_id] || 0) + 1;
      });

      const teachersWithCounts = (profiles || []).map((teacher) => ({
        ...teacher,
        full_name: teacher.full_name || [teacher.first_name, teacher.last_name].filter(Boolean).join(" ") || null,
        teacher_assignments: [{ count: assignmentsByTeacher[teacher.id] || 0 }],
      }));

      setTeachers(teachersWithCounts);
    } catch (error) {
      console.error("Failed to fetch teachers:", error);
    } finally {
      setLoading(false);
    }
  }

  const getName = (teacher: Teacher) => {
    if (teacher.full_name) return teacher.full_name;
    if (teacher.first_name || teacher.last_name) {
      return [teacher.first_name, teacher.last_name].filter(Boolean).join(" ");
    }
    return "-";
  };

  const getStatusBadge = (status: string | null) => {
    const variant = status === "active" ? "default" : "secondary";
    let className = "";
    if (status === "active") {
      className = "bg-green-600";
    } else if (status === "trial") {
      className = "bg-blue-600";
    } else if (status === "inactive") {
      className = "bg-red-600";
    }
    return (
      <Badge variant={variant} className={`${className} ${!status || status === 'inactive' ? 'text-white' : ''}`}>
        {status || "unknown"}
      </Badge>
    );
  };

  if (loading) {
    return <div className="text-center py-8 text-[#666666]">Loading teachers...</div>;
  }

  return (
    <Card className="border-[#e5e5e0] shadow-sm">
      <CardHeader>
        <CardTitle className="text-[#2d2d2d]">All Teachers ({teachers.length})</CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        {teachers.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Discipline</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Courses</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {teachers.map((teacher) => (
                <TableRow key={teacher.id}>
                  <TableCell className="font-medium">{getName(teacher)}</TableCell>
                  <TableCell className="text-[#666666]">{teacher.email}</TableCell>
                  <TableCell className="text-[#666666]">{teacher.primary_discipline || "N/A"}</TableCell>
                  <TableCell>{getStatusBadge(teacher.enrollment_status)}</TableCell>
                  <TableCell>
                    <Badge
                      variant={teacher.role === "admin" ? "default" : "secondary"}
                      className={teacher.role === "admin" ? "bg-[#0d7377]" : ""}
                    >
                      {teacher.role}
                    </Badge>
                  </TableCell>
                  <TableCell>{teacher.teacher_assignments?.[0]?.count || 0}</TableCell>
                  <TableCell>
                    <div className="flex gap-2 flex-wrap">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.push(`/admin/teachers/${teacher.id}`)}
                        className="border-[#0d7377] text-[#0d7377] hover:bg-[#0d7377] hover:text-white"
                      >
                        Edit
                      </Button>
                      <AssignCoursesDialog
                        teacherId={teacher.id}
                        teacherName={getName(teacher)}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-[#666666] text-center py-8">No teachers found.</p>
        )}
      </CardContent>
    </Card>
  );
}
