"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

interface SaveVersionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (name: string, reason: string | null) => void;
  defaultName?: string;
  isLoading?: boolean;
}

export function SaveVersionDialog({
  open,
  onOpenChange,
  onSave,
  defaultName = "",
  isLoading = false,
}: SaveVersionDialogProps) {
  const [name, setName] = useState(defaultName);
  const [reason, setReason] = useState("");

  const handleSave = () => {
    onSave(name, reason || null);
    setName("");
    setReason("");
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setName("");
      setReason("");
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Save as Version</DialogTitle>
          <DialogDescription>
            Give this version a name to help you remember what it contains.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label htmlFor="version-name" className="text-sm font-medium text-gray-700">
              Version Name
            </label>
            <Input
              id="version-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Shorter 3rd Grade, Gym Adaptation"
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="reason" className="text-sm font-medium text-gray-700">
              Modification Reason (optional)
            </label>
            <Input
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., 30 minute version for assemblies"
              disabled={isLoading}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isLoading || !name.trim()}>
            {isLoading ? "Saving..." : "Save Version"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
