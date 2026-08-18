"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface Teacher {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
}

interface BulkDeleteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teachers: Teacher[];
  onConfirm: (ids: string[]) => Promise<void>;
}

export function BulkDeleteModal({
  open,
  onOpenChange,
  teachers,
  onConfirm,
}: BulkDeleteModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const getName = (teacher: Teacher) => {
    if (teacher.full_name) return teacher.full_name;
    if (teacher.first_name || teacher.last_name) {
      return [teacher.first_name, teacher.last_name].filter(Boolean).join(" ");
    }
    return teacher.email;
  };

  const handleConfirm = async () => {
    setLoading(true);
    setError("");
    try {
      await onConfirm(teachers.map((t) => t.id));
      onOpenChange(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to delete teachers";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-5 w-5" />
            Delete {teachers.length} Teacher{teachers.length !== 1 ? "s" : ""}
          </DialogTitle>
          <DialogDescription>
            This action cannot be undone. The following teachers will be permanently deleted:
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-60 overflow-y-auto border rounded-lg p-3 space-y-2">
          {teachers.map((teacher) => (
            <div key={teacher.id} className="text-sm">
              <span className="font-medium">{getName(teacher)}</span>
              <span className="text-gray-500 ml-2">({teacher.email})</span>
            </div>
          ))}
        </div>

        {error && (
          <div className="p-3 text-sm text-red-600 bg-red-50 rounded-md">{error}</div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={loading}>
            {loading ? "Deleting..." : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
