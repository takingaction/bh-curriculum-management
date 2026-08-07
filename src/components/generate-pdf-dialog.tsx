"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, AlertCircle } from "lucide-react";
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

interface PdfUsageInfo {
  pdf_count: number;
  limit: number;
  remaining: number;
}

type DialogState = "confirm" | "generating" | "done" | "error";

export function GeneratePdfDialog({
  open,
  onOpenChange,
  lessonId,
  version,
  onPdfGenerated,
}: GeneratePdfDialogProps) {
  const [dialogState, setDialogState] = useState<DialogState>("confirm");
  const [error, setError] = useState<string | null>(null);
  const [usageInfo, setUsageInfo] = useState<PdfUsageInfo | null>(null);

  useEffect(() => {
    if (open) {
      setDialogState("confirm");
      setError(null);
      fetchUsageInfo();
    }
  }, [open]);

  const fetchUsageInfo = async () => {
    try {
      const res = await fetch("/api/pdf-usage");
      if (res.ok) {
        const data = await res.json();
        setUsageInfo(data);
      }
    } catch {
      console.error("Failed to fetch PDF usage");
    }
  };

  const handleConfirm = async () => {
    setDialogState("generating");
    setError(null);

    try {
      const res = await fetch(`/api/lessons/${lessonId}/versions/${version.id}/pdf`, {
        method: "POST",
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 403 && data.error === "Weekly PDF limit reached") {
          setError(`You have reached your weekly limit of ${data.limit} PDFs.`);
          setDialogState("error");
        } else {
          setError(data.error || "Failed to generate PDF");
          setDialogState("error");
        }
        return;
      }

      if (data.success) {
        setUsageInfo((prev) =>
          prev
            ? {
                ...prev,
                pdf_count: data.pdf_count,
                remaining: data.remaining,
              }
            : null
        );

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

  const handleRetry = () => {
    setDialogState("confirm");
    setError(null);
  };

  const hasLimitReached = usageInfo && usageInfo.remaining <= 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[90%] md:w-[50%] md:max-w-[50%]">
        <DialogHeader>
          <DialogTitle>Generate PDF</DialogTitle>
        </DialogHeader>

        <div className="py-2">
          {dialogState === "confirm" && (
            <div className="space-y-3">
              <p className="text-sm font-medium text-gray-800">
                Version: {getVersionDisplayName(version)}
              </p>

              {version.modification_reason && (
                <p className="text-sm text-gray-600">
                  Reason: {version.modification_reason}
                </p>
              )}

              {usageInfo && (
                <p className="text-sm">
                  This will be PDF <strong>{usageInfo.pdf_count + 1}</strong> of{" "}
                  <strong>{usageInfo.limit}</strong> for the week. Continue?
                </p>
              )}

              {error && (
                <div className="flex items-start gap-2 text-red-600 bg-red-50 p-3 rounded-lg">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <p className="text-sm">{error}</p>
                </div>
              )}
            </div>
          )}

          {dialogState === "generating" && (
            <div className="flex flex-col items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-[#0d7377]" />
              <p className="mt-4 text-gray-600">Generating PDF...</p>
            </div>
          )}

          {dialogState === "done" && (
            <div className="flex flex-col items-center justify-center py-8">
              <p className="text-green-600 font-medium">PDF Generated Successfully!</p>
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
          {dialogState === "confirm" && (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleConfirm} disabled={!!hasLimitReached || !usageInfo}>
                Yes, Continue
              </Button>
            </>
          )}

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
              <Button onClick={handleRetry}>
                Try Again
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
