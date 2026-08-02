"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface TrialPdfModalProps {
  open: boolean;
  onClose: () => void;
}

export function TrialPdfModal({ open, onClose }: TrialPdfModalProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[#e85d5d]">PDF Not Available</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <p className="text-gray-700 text-center">
            PDFs are not available at the trial level.
            <br />
            Please contact support to activate your full account.
          </p>
          <p className="text-sm text-gray-500 text-center mt-2">
            support@betterhumanseducation.com
          </p>
        </div>
        <DialogFooter>
          <Button
            onClick={onClose}
            className="bg-[#0d7377] hover:bg-[#0a5c5f] w-full"
          >
            OK
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
