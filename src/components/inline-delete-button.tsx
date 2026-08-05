"use client";

import { Button } from "@/components/ui/button";

interface InlineDeleteButtonProps {
  courseId: string;
  courseTitle: string;
}

export function InlineDeleteButton({ courseId, courseTitle }: InlineDeleteButtonProps) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => {
        if (confirm(`Delete course "${courseTitle}"? This cannot be undone.`)) {
          fetch(`/api/admin/courses/${courseId}`, { method: "DELETE" })
            .then(res => {
              if (res.ok) window.location.href = "/admin/courses";
            });
        }
      }}
      className="border-red-300 text-red-600 hover:bg-red-50"
    >
      Delete
    </Button>
  );
}
