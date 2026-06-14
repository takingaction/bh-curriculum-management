"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { X, Move } from "lucide-react";

interface SpotifyEmbedProps {
  open: boolean;
  onClose: () => void;
  embedCode: string;
}

export function SpotifyEmbed({ open, onClose, embedCode }: SpotifyEmbedProps) {
  const [size, setSize] = useState({ width: 380, height: 450 });
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const nodeRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef({ mouseX: 0, mouseY: 0, posX: 0, posY: 0 });
  const startSizeRef = useRef({ width: 0, height: 0 });
  const startCursorRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (open && nodeRef.current) {
      const windowWidth = window.innerWidth;
      const newX = windowWidth - size.width - 20;
      setPosition({ x: newX, y: 20 });
      nodeRef.current.style.left = `${newX}px`;
      nodeRef.current.style.top = "20px";
    }
  }, [open, size]);

  const handleDragStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      posX: position.x,
      posY: position.y,
    };
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - dragStartRef.current.mouseX;
      const deltaY = e.clientY - dragStartRef.current.mouseY;
      const newX = dragStartRef.current.posX + deltaX;
      const newY = dragStartRef.current.posY + deltaY;
      setPosition({ x: newX, y: newY });
      if (nodeRef.current) {
        nodeRef.current.style.left = `${newX}px`;
        nodeRef.current.style.top = `${newY}px`;
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging]);

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    startSizeRef.current = { ...size };
    startCursorRef.current = { x: e.clientX, y: e.clientY };

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - startCursorRef.current.x;
      const deltaY = e.clientY - startCursorRef.current.y;
      setSize({
        width: Math.max(300, startSizeRef.current.width + deltaX),
        height: Math.max(300, startSizeRef.current.height + deltaY),
      });
    };

    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.body.style.cursor = "se-resize";
    document.body.style.userSelect = "none";
  };

  if (!open) return null;

  return (
    <div
      ref={nodeRef}
      className="fixed bg-white shadow-2xl rounded-lg z-[60] flex flex-col"
      style={{
        width: size.width,
        height: size.height,
        left: position.x,
        top: position.y,
      }}
    >
      <div
        className="spotify-embed-header flex items-center justify-between p-3 bg-[#0d7377] text-white rounded-t-lg cursor-move select-none"
        onMouseDown={handleDragStart}
      >
        <div className="flex items-center gap-2">
          <Move className="w-4 h-4" />
          <span className="font-medium text-sm">Spotify Playlist</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 hover:bg-white/20 rounded"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="flex-1 p-3 overflow-hidden">
        <div
          className="w-full h-full"
          dangerouslySetInnerHTML={{ __html: embedCode }}
        />
      </div>
      <div
        className="absolute bottom-0 right-0 w-5 h-5 cursor-se-resize"
        onMouseDown={handleResizeStart}
      >
        <svg
          className="w-full h-full text-gray-300 hover:text-gray-400"
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d="M22 22H2V20H20V2H22V22Z" />
        </svg>
      </div>
    </div>
  );
}