"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileText } from "lucide-react";

interface CourseMaterialsModalProps {
  open: boolean;
  onClose: () => void;
  courseName: string;
  materials?: string | null;
}

export function CourseMaterialsModal({
  open,
  onClose,
  courseName,
  materials,
}: CourseMaterialsModalProps) {
  const materialList = materials
    ? materials.split("\n").filter((line) => line.trim())
    : [];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Course Materials
          </DialogTitle>
        </DialogHeader>

        <div className="py-4">
          {materialList.length > 0 ? (
            <ol className="list-decimal list-inside space-y-2">
              {materialList.map((material, index) => (
                <li key={index} className="text-gray-700">
                  {material}
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-gray-500 text-center py-4">
              There are no materials for this course.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
