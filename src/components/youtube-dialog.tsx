"use client";

import { useState, useEffect, useRef } from "react";

interface YouTubeDialogProps {
  videoUrl: string;
  onClose: () => void;
}

export default function YouTubeDialog({ videoUrl, onClose }: YouTubeDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  const getYouTubeId = (url: string): string => {
    const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&?]+)/);
    return match ? match[1] : '';
  };

  const videoId = getYouTubeId(videoUrl);
  const youtubeWatchUrl = `https://www.youtube.com/watch?v=${videoId}`;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    dialog.showModal();
  }, []);

  const handleClose = () => {
    const dialog = dialogRef.current;
    if (dialog) {
      dialog.close();
    }
    onClose();
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === dialogRef.current) {
      handleClose();
    }
  };

  return (
    <dialog
      ref={dialogRef}
      onClick={handleBackdropClick}
      className="p-0 bg-transparent backdrop:bg-black/80 fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
    >
      <div className="relative">
        <button
          onClick={handleClose}
          className="absolute -top-10 right-0 text-white hover:text-gray-300 transition-colors"
          aria-label="Close video"
        >
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <iframe
          src={`https://www.youtube.com/embed/${videoId}?autoplay=1`}
          title="YouTube Video"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="w-[80vw] max-w-4xl aspect-video"
        />
        <a
          href={youtubeWatchUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block mt-2 text-white hover:text-gray-300 text-sm text-center"
        >
          ▶ Watch on YouTube
        </a>
      </div>
    </dialog>
  );
}
