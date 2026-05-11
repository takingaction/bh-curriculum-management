"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

export function DeleteCourseButton({ courseId, courseTitle }: { courseId: string; courseTitle: string }) {
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/courses/${courseId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        router.push("/admin/courses");
      } else {
        console.error("Failed to delete course");
        setDeleting(false);
      }
    } catch (error) {
      console.error("Failed to delete course:", error);
      setDeleting(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors bg-red-600 text-white hover:bg-red-700 h-10 px-4 py-2 cursor-pointer border-0"
      >
        Delete
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Course</DialogTitle>
          </DialogHeader>
          <p className="text-[#666666]">
            Are you sure you want to delete <strong>{courseTitle}</strong>? This will also delete all lessons in this course and cannot be undone.
          </p>
          <DialogFooter>
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={deleting}
              className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors border border-input bg-background h-10 px-4 py-2 hover:bg-accent hover:text-accent-foreground cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors bg-red-600 text-white hover:bg-red-700 h-10 px-4 py-2 cursor-pointer border-0"
            >
              {deleting ? "Deleting..." : "Delete Course"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
