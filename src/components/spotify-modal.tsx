"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Music2 } from "lucide-react";

interface SpotifyModalProps {
  open: boolean;
  onClose: () => void;
  lessonId: string;
  existingCode?: string;
  onSave: (embedCode: string) => Promise<void>;
}

export function SpotifyModal({
  open,
  onClose,
  lessonId,
  existingCode = "",
  onSave,
}: SpotifyModalProps) {
  const [embedCode, setEmbedCode] = useState(existingCode);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!embedCode.trim()) return;
    setSaving(true);
    try {
      await onSave(embedCode.trim());
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
            <Music2 className="w-4 h-4" />
            {existingCode ? "Edit Spotify Playlist" : "Add Spotify Playlist"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="spotify-embed">Embed Code</Label>
            <textarea
              id="spotify-embed"
              value={embedCode}
              onChange={(e) => setEmbedCode(e.target.value)}
              placeholder="Paste Spotify embed code here..."
              rows={6}
              className="w-full p-3 border border-[#e5e5e0] rounded-lg text-sm focus:border-[#0d7377] focus:outline-none resize-none"
            />
            <p className="text-xs text-gray-500">
              Go to Spotify → Share → Embed Playlist, then copy the code
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!embedCode.trim() || saving}
            className="bg-[#0d7377] hover:bg-[#0a5c5f]"
          >
            {saving ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface SpotifyLinkProps {
  onClick: () => void;
}

export function SpotifyLink({ onClick }: SpotifyLinkProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 text-xs text-[#0d7377] hover:underline"
    >
      <Music2 className="w-3 h-3" />
      Spotify Playlist
    </button>
  );
}