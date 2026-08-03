"use client";

import { useState, useEffect, useRef } from "react";

interface VideoDialogProps {
  videoUrl?: string;
}

export default function VideoDialog({ videoUrl }: VideoDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);

  const getYouTubeId = (url: string): string => {
    const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&?]+)/);
    return match ? match[1] : '';
  };

  const videoId = videoUrl ? getYouTubeId(videoUrl) : "YKpdxwcm3LE";
  const youtubeWatchUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const thumbnailSrc = "/images/video-thumbnail.jpg";

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      dialog.showModal();
    } else {
      dialog.close();
    }
  }, [isOpen]);

  const handleClose = () => {
    setIsOpen(false);
  };

  return (
    <>
      <section className="relative rounded-xl overflow-hidden">
        <div className="absolute inset-0">
          <img
            src={thumbnailSrc}
            alt="Welcome video"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black/30" />
        </div>

        <div className="relative z-10 py-12 px-6 text-center">
          <h3 className="text-white text-2xl font-bold mb-2">Welcome to Performers Ready!</h3>
          <p className="text-white/80 mb-4">Watch our introduction video to get started (currently a placeholder video - real video coming shortly!)</p>
          <button
            onClick={() => setIsOpen(true)}
            className="group flex items-center justify-center w-16 h-16 mx-auto rounded-full bg-white/90 hover:bg-white transition-colors shadow-lg"
            aria-label="Play video"
          >
            <svg
              className="w-8 h-8 text-[#0d7377] ml-1"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M8 5v14l11-7z" />
            </svg>
          </button>
        </div>
      </section>

      <dialog
        ref={dialogRef}
        onClick={(e) => {
          if (e.target === dialogRef.current) handleClose();
        }}
        className="p-0 bg-transparent backdrop:bg-black/80 fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
      >
        {isOpen && (
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
        )}
      </dialog>
    </>
  );
}
