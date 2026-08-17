"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import type { LessonVersion } from "@/lib/version-utils";

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
  const [isGenerating, setIsGenerating] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (open && !isGenerating) {
      setIsGenerating(true);
      setDialogState("generating");
      setError(null);
      handleGenerate();
    }
  }, [open]);

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsGenerating(false);
    onOpenChange(false);
  };

  const handleGenerate = async () => {
    abortControllerRef.current = new AbortController();
    setDialogState("generating");
    setError(null);

    try {
      const res = await fetch(`/api/lessons/${lessonId}/versions/${version.id}/pdf`, {
        method: "POST",
        signal: abortControllerRef.current.signal,
      });

      const data = await res.json();

      if (!res.ok) {
        const errorMessage = data.diagnostics
          ? `Failed to generate PDF: ${data.error}\n\nDiagnostics: ${JSON.stringify(data.diagnostics, null, 2)}`
          : data.error || "Failed to generate PDF";
        setError(errorMessage);
        setDialogState("error");
        return;
      }

      if (data.success) {
        if (onPdfGenerated) {
          onPdfGenerated(data.filename);
        }
        setDialogState("done");
      }
    } catch (err: any) {
      if (err.name === "AbortError") {
        setIsGenerating(false);
        return;
      }
      setError("Failed to generate PDF. Please check your connection and try again.");
      setDialogState("error");
    } finally {
      abortControllerRef.current = null;
    }
  };

  const handleClose = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsGenerating(false);
    setDialogState("generating");
    setError(null);
    onOpenChange(false);
  };

  const handleTryAgain = () => {
    handleGenerate();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
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
              <p className="mt-4 text-green-600 font-medium">PDF Created Successfully!</p>
            </div>
          )}

          {dialogState === "error" && (
            <div className="space-y-4">
              <div className="flex items-start gap-2 text-red-600 bg-red-50 p-3 rounded-lg">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <p className="text-sm whitespace-pre-wrap">{error}</p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          {dialogState === "generating" && (
            <Button variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
          )}

          {dialogState === "done" && (
            <Button onClick={handleClose}>
              Close
            </Button>
          )}

          {dialogState === "error" && (
            <>
              <Button variant="outline" onClick={handleClose}>
                Close
              </Button>
              <Button onClick={handleTryAgain}>
                Try Again
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
