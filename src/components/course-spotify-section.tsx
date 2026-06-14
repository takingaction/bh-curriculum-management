"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { SpotifyModal, SpotifyLink } from "@/components/spotify-modal";

interface CourseSpotifySectionProps {
  courseId: string;
  initialSpotifyCode: string;
}

export function CourseSpotifySection({ courseId, initialSpotifyCode }: CourseSpotifySectionProps) {
  const [spotifyEmbedCode, setSpotifyEmbedCode] = useState(initialSpotifyCode);
  const [showSpotifyModal, setShowSpotifyModal] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSaveSpotify = async (embedCode: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/courses/${courseId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spotify_embed_code: embedCode }),
      });
      if (!res.ok) throw new Error("Failed to save");
      setSpotifyEmbedCode(embedCode);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveSpotify = async () => {
    if (!confirm("Remove Spotify playlist?")) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/courses/${courseId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spotify_embed_code: null }),
      });
      if (!res.ok) throw new Error("Failed to remove");
      setSpotifyEmbedCode("");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg border border-[#e5e5e0] p-4">
      <h3 className="text-sm font-bold text-[#2d2d2d] mb-3">Spotify Playlist</h3>
      {spotifyEmbedCode ? (
        <div className="flex items-center gap-3 py-2 px-3 bg-gray-50 rounded-lg">
          <SpotifyLink onClick={() => {}} />
          <button type="button" onClick={() => setShowSpotifyModal(true)} className="text-xs text-[#0d7377] hover:underline">Edit</button>
          <button type="button" onClick={handleRemoveSpotify} className="text-xs text-red-600 hover:underline">Remove</button>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setShowSpotifyModal(true)}
          className="border-[#e5e5e0]"
        >
          Add Spotify Playlist
        </Button>
      )}
      <SpotifyModal
        open={showSpotifyModal}
        onClose={() => setShowSpotifyModal(false)}
        lessonId={courseId}
        existingCode={spotifyEmbedCode}
        onSave={handleSaveSpotify}
      />
    </div>
  );
}