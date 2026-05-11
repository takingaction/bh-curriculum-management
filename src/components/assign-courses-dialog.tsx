"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckIcon } from "lucide-react";

interface Course {
  id: string;
  title: string;
  discipline: string;
  grade: string;
}

export function AssignCoursesDialog({ teacherId, teacherName }: { teacherId: string; teacherName: string }) {
  const [open, setOpen] = useState(false);
  const [courses, setCourses] = useState<Course[]>([]);
  const [assignedCourseIds, setAssignedCourseIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      fetchData();
    }
  }, [open]);

  async function fetchData() {
    setLoading(true);
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();

      const [coursesRes, assignmentsRes] = await Promise.all([
        supabase.from("courses").select("id, title, discipline, grade").order("title"),
        supabase.from("teacher_assignments").select("course_id").eq("teacher_id", teacherId),
      ]);

      setCourses(coursesRes.data || []);
      setAssignedCourseIds(assignmentsRes.data?.map((a: { course_id: string }) => a.course_id) || []);
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setLoading(false);
    }
  }

  async function toggleCourse(courseId: string) {
    setSaving(true);
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const isAssigned = assignedCourseIds.includes(courseId);

      if (isAssigned) {
        await supabase
          .from("teacher_assignments")
          .delete()
          .eq("teacher_id", teacherId)
          .eq("course_id", courseId);
        setAssignedCourseIds(assignedCourseIds.filter((id) => id !== courseId));
      } else {
        await supabase.from("teacher_assignments").insert({
          teacher_id: teacherId,
          course_id: courseId,
        });
        setAssignedCourseIds([...assignedCourseIds, courseId]);
      }
    } catch (error) {
      console.error("Failed to toggle assignment:", error);
      alert("Failed to update assignment");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger>
        <Button variant="outline" size="sm" className="border-[#e5e5e0]">
          Assign Courses
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Assign Courses to {teacherName || "Teacher"}</DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="text-center py-8 text-[#666666]">Loading courses...</div>
        ) : courses.length === 0 ? (
          <div className="text-center py-8 text-[#666666]">No courses available</div>
        ) : (
          <ScrollArea className="max-h-[400px]">
            <div className="space-y-2 pr-4">
              {courses.map((course) => {
                const isAssigned = assignedCourseIds.includes(course.id);
                return (
                  <button
                    key={course.id}
                    type="button"
                    onClick={() => toggleCourse(course.id)}
                    disabled={saving}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                      isAssigned
                        ? "border-[#0d7377] bg-[#d7ffef]"
                        : "border-[#e5e5e0] hover:border-[#0d7377]"
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded flex items-center justify-center ${
                        isAssigned ? "bg-[#0d7377] text-white" : "border border-[#e5e5e0]"
                      }`}
                    >
                      {isAssigned && <CheckIcon className="w-4 h-4" />}
                    </div>
                    <div className="text-left flex-1">
                      <div className="font-medium text-sm">{course.title}</div>
                      <div className="text-xs text-[#666666]">
                        {course.discipline} · Grade {course.grade}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
