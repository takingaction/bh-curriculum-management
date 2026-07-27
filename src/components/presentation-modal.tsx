"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ExternalLink, Play } from "lucide-react";

interface PresentationModalProps {
  open: boolean;
  onClose: () => void;
  lessonId: string;
  existingName?: string;
  existingUrl?: string;
  onSave: (name: string, url: string) => Promise<void>;
}

export function PresentationModal({
  open,
  onClose,
  lessonId,
  existingName = "",
  existingUrl = "",
  onSave,
}: PresentationModalProps) {
  const [name, setName] = useState(existingName);
  const [url, setUrl] = useState(existingUrl);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim() || !url.trim()) return;
    setSaving(true);
    try {
      await onSave(name.trim(), url.trim());
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ExternalLink className="w-4 h-4" />
            {existingName ? "Edit Presentation" : "Add Presentation"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="presentation-name">Name</Label>
            <Input
              id="presentation-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Warm Up Slides"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="presentation-url">URL</Label>
            <Input
              id="presentation-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://..."
              type="url"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!name.trim() || !url.trim() || saving}
            className="bg-[#0d7377] hover:bg-[#0a5c5f]"
          >
            {saving ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface PresentationLinkProps {
  name: string;
  url: string;
}

function getGoogleSlidesPresentUrl(url: string): string | null {
  const match = url.match(/docs\.google\.com\/presentation\/d\/([a-zA-Z0-9_-]+)/);
  if (match) {
    return `https://docs.google.com/presentation/d/${match[1]}/present`;
  }
  return null;
}

export function PresentationLink({ name, url }: PresentationLinkProps) {
  const presentUrl = getGoogleSlidesPresentUrl(url);

  return (
    <div className="flex items-center gap-2">
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1.5 text-xs text-[#0d7377] hover:underline"
      >
        <ExternalLink className="w-3 h-3" />
        {name}
      </a>
      {presentUrl && (
        <a
          href={presentUrl}
          target="_blank"
          rel="noopener noreferrer"
          title="Open in presentation mode"
          className="flex items-center text-xs text-[#0d7377] hover:underline"
        >
          <Play className="w-3 h-3" fill="#0d7377" />
        </a>
      )}
    </div>
  );
}