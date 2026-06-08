"use client";

import { X } from "lucide-react";

interface SpotifySlideoutProps {
  open: boolean;
  onClose: () => void;
  embedCode: string;
}

export function SpotifySlideout({ open, onClose, embedCode }: SpotifySlideoutProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />
      <div className="absolute top-0 right-0 h-full w-full max-w-md bg-white shadow-xl animate-in slide-in-from-right duration-300">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold text-lg">Spotify Playlist</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 h-[calc(100%-64px)] overflow-y-auto">
          <div
            className="w-full"
            dangerouslySetInnerHTML={{ __html: embedCode }}
          />
        </div>
      </div>
    </div>
  );
}