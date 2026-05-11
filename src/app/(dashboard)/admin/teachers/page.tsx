"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useRouter } from "next/navigation";
import { AssignCoursesDialog } from "@/components/assign-courses-dialog";

interface Teacher {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  created_at: string;
  teacher_assignments?: { count: number }[];
}

export default function TeachersPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handlePromote = async (teacherId: string) => {
    if (!confirm("Promote this teacher to admin?")) return;

    try {
      const res = await fetch(`/api/admin/teachers/${teacherId}/promote`, {
        method: "POST",
      });
      const data = await res.json();

      if (res.ok) {
        alert(data.message);
        router.refresh();
      } else {
        alert(data.error || "Failed to promote teacher");
      }
    } catch (error) {
      alert("Failed to promote teacher");
    }
  };

  const handleInvite = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;

    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();

      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          data: {
            role: "teacher",
          },
        },
      });

      if (error) {
        alert(error.message);
      } else {
        alert(`Sign-in link sent to ${email}`);
        (e.target as HTMLFormElement).reset();
        router.refresh();
      }
    } catch (error) {
      alert("Failed to send invitation");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-[#2d2d2d]">Teachers</h2>
        <p className="text-[#666666]">Manage teacher accounts and course assignments</p>
      </div>

      <Card className="border-[#e5e5e0] shadow-sm mb-8">
        <CardHeader>
          <CardTitle className="text-[#2d2d2d]">Invite New Teacher</CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <form onSubmit={handleInvite} className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="text-sm font-medium text-[#2d2d2d] mb-2 block">
                Email Address
              </label>
              <Input
                name="email"
                type="email"
                placeholder="teacher@school.edu"
                required
                className="border-[#e5e5e0] focus:border-[#0d7377]"
              />
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="bg-[#0d7377] hover:bg-[#0a5c5f] text-white"
            >
              {loading ? "Sending..." : "Send Invitation"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <TeacherList onPromote={handlePromote} />
    </div>
  );
}

function TeacherList({ onPromote }: { onPromote: (id: string) => void }) {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);

  useState(() => {
    fetchTeachers();
  });

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
        .select("teacher_id, count");

      const teachersWithCounts = (profiles || []).map((teacher) => ({
        ...teacher,
        teacher_assignments: assignments?.filter((a) => a.teacher_id === teacher.id) || [],
      }));

      setTeachers(teachersWithCounts);
    } catch (error) {
      console.error("Failed to fetch teachers:", error);
    } finally {
      setLoading(false);
    }
  }

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
                <TableHead>Role</TableHead>
                <TableHead>Assigned Courses</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {teachers.map((teacher) => (
                <TableRow key={teacher.id}>
                  <TableCell className="font-medium">{teacher.full_name || "-"}</TableCell>
                  <TableCell className="text-[#666666]">{teacher.email}</TableCell>
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
                    <div className="flex gap-2">
                      {teacher.role === "teacher" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onPromote(teacher.id)}
                          className="border-[#0d7377] text-[#0d7377] hover:bg-[#0d7377] hover:text-white"
                        >
                          Promote to Admin
                        </Button>
                      )}
                      <AssignCoursesDialog
                        teacherId={teacher.id}
                        teacherName={teacher.full_name || teacher.email}
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