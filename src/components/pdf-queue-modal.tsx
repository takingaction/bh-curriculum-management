"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface PdfQueueModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: string;
  pdfType: "lesson" | "version" | "course" | "discipline";
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

type ModalState = "queued" | "processing" | "completed" | "failed";

const POLL_INTERVAL = 2000;
const TIMEOUT_MS = 60000;

export function PdfQueueModal({
  open,
  onOpenChange,
  jobId,
  pdfType,
  onSuccess,
  onError,
}: PdfQueueModalProps) {
  const [modalState, setModalState] = useState<ModalState>("queued");
  const [position, setPosition] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [startTime] = useState<number>(Date.now());

  const checkStatus = useCallback(async () => {
    if (!jobId) return;

    try {
      const res = await fetch(`/api/pdf/queue/status/${jobId}`);

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to get status");
      }

      const data = await res.json();

      if (data.status === "completed") {
        setModalState("completed");
        if (onSuccess) onSuccess();
        return;
      }

      if (data.status === "failed") {
        setModalState("failed");
        setErrorMessage(data.error || "PDF generation failed");
        if (onError) onError(data.error || "PDF generation failed");
        return;
      }

      if (data.status === "processing") {
        setModalState("processing");
        setPosition(0);
      }

      if (data.status === "pending") {
        setModalState("queued");
        setPosition(data.position || 0);
      }
    } catch (err: any) {
      setModalState("failed");
      setErrorMessage(err.message || "Failed to check status");
      if (onError) onError(err.message);
    }
  }, [jobId, onSuccess, onError]);

  const handleCancel = async () => {
    if (!jobId) return;

    try {
      await fetch(`/api/pdf/queue/cancel/${jobId}`, { method: "DELETE" });
    } catch (err) {
      console.error("Failed to cancel job:", err);
    }

    onOpenChange(false);
  };

  useEffect(() => {
    if (!open || !jobId) return;

    const pollInterval = setInterval(checkStatus, POLL_INTERVAL);

    const timeout = setTimeout(() => {
      clearInterval(pollInterval);
      if (modalState !== "completed" && modalState !== "failed") {
        setModalState("failed");
        setErrorMessage("Request timed out. You can try again shortly.");
        if (onError) onError("Request timed out");
      }
    }, TIMEOUT_MS);

    checkStatus();

    return () => {
      clearInterval(pollInterval);
      clearTimeout(timeout);
    };
  }, [open, jobId, checkStatus, modalState, onError]);

  useEffect(() => {
    if (!open) {
      setModalState("queued");
      setPosition(0);
      setErrorMessage(null);
    }
  }, [open]);

  const getTitle = () => {
    switch (pdfType) {
      case "lesson":
        return "Lesson PDF";
      case "version":
        return "Version PDF";
      case "course":
        return "Course PDF";
      case "discipline":
        return "Discipline PDF";
      default:
        return "PDF";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[90%] md:w-[50%] md:max-w-[50%]">
        <DialogHeader>
          <DialogTitle>Generating {getTitle()}</DialogTitle>
        </DialogHeader>

        <div className="py-6">
          {modalState === "queued" && (
            <div className="flex flex-col items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-[#0d7377]" />
              <p className="mt-4 text-gray-600">
                Your PDF is #{position} in queue
              </p>
            </div>
          )}

          {modalState === "processing" && (
            <div className="flex flex-col items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-[#0d7377]" />
              <p className="mt-4 text-gray-600">Generating your PDF</p>
            </div>
          )}

          {modalState === "completed" && (
            <div className="flex flex-col items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
              <p className="mt-4 text-green-600 font-medium">
                PDF Generated Successfully!
              </p>
            </div>
          )}

          {modalState === "failed" && (
            <div className="flex flex-col items-center justify-center">
              <XCircle className="w-8 h-8 text-red-600" />
              <p className="mt-4 text-red-600 font-medium">
                PDF Generation Failed
              </p>
              {errorMessage && (
                <p className="mt-2 text-sm text-gray-600 text-center">
                  {errorMessage}
                </p>
              )}
              <p className="mt-2 text-sm text-gray-500">
                You can try again shortly.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          {modalState === "queued" && (
            <>
              <Button variant="outline" onClick={handleCancel}>
                Cancel
              </Button>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
            </>
          )}

          {modalState === "processing" && (
            <>
              <Button variant="outline" onClick={handleCancel}>
                Cancel
              </Button>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
            </>
          )}

          {modalState === "completed" && (
            <Button onClick={() => onOpenChange(false)}>Done</Button>
          )}

          {modalState === "failed" && (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
              <Button
                onClick={() => {
                  setModalState("queued");
                  setErrorMessage(null);
                }}
              >
                Try Again
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
