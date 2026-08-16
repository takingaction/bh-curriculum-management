"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import type { LessonVersion } from "@/lib/version-utils";
import { getVersionDisplayName } from "@/lib/version-utils";

interface GeneratePdfDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lessonId: string;
  version: LessonVersion;
  onPdfGenerated?: (pdfPath: string) => void;
}

type DialogState = "generating" | "done" | "error";

export function GeneratePdfDialog({
  open,
  onOpenChange,
  lessonId,
  version,
  onPdfGenerated,
}: GeneratePdfDialogProps) {
  const [dialogState, setDialogState] = useState<DialogState>("generating");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log("[GeneratePdfDialog] useEffect running, open:", open);
    if (open) {
      console.log("[GeneratePdfDialog] Dialog opened, calling handleGenerate");
      setDialogState("generating");
      setError(null);
      handleGenerate();
    }
  }, [open]);

  const handleGenerate = async () => {
    console.log("[GeneratePdfDialog] handleGenerate called, lessonId:", lessonId, "version.id:", version.id);
    setDialogState("generating");
    setError(null);

    try {
      console.log("[GeneratePdfDialog] Fetching PDF API...");
      const res = await fetch(`/api/lessons/${lessonId}/versions/${version.id}/pdf`, {
        method: "POST",
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to generate PDF");
        setDialogState("error");
        return;
      }

      if (data.success) {
        if (onPdfGenerated) {
          onPdfGenerated(data.filename);
        }
        setDialogState("done");
        setTimeout(() => {
          onOpenChange(false);
        }, 1500);
      }
    } catch (err) {
      setError("Failed to generate PDF. Please try again.");
      setDialogState("error");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[90%] md:w-[50%] md:max-w-[50%]">
        <DialogHeader>
          <DialogTitle>Generate PDF</DialogTitle>
        </DialogHeader>

        <div className="py-2">
          {dialogState === "generating" && (
            <div className="flex flex-col items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-[#0d7377]" />
              <p className="mt-4 text-gray-600">Generating PDF...</p>
            </div>
          )}

          {dialogState === "done" && (
            <div className="flex flex-col items-center justify-center py-8">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
              <p className="mt-4 text-green-600 font-medium">PDF Generated Successfully!</p>
            </div>
          )}

          {dialogState === "error" && (
            <div className="space-y-4">
              <div className="flex items-start gap-2 text-red-600 bg-red-50 p-3 rounded-lg">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <p className="text-sm">{error}</p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          {dialogState === "generating" && (
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
          )}

          {dialogState === "done" && (
            <Button onClick={() => onOpenChange(false)}>
              Done
            </Button>
          )}

          {dialogState === "error" && (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleGenerate}>
                Try Again
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
