"use client";

import { useState, useRef, useEffect } from "react";
import { X, Move } from "lucide-react";

interface SpotifyEmbedProps {
  open: boolean;
  onClose: () => void;
  embedCode: string;
}

export function SpotifyEmbed({ open, onClose, embedCode }: SpotifyEmbedProps) {
  const [size, setSize] = useState({ width: 380, height: 450 });
  const [visible, setVisible] = useState(false);
  const nodeRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ mouseX: 0, mouseY: 0, left: 0, top: 0 });
  const startSizeRef = useRef({ width: 0, height: 0 });
  const startCursorRef = useRef({ x: 0, y: 0 });
  const currentLeftRef = useRef(0);
  const currentTopRef = useRef(0);

  useEffect(() => {
    if (open) {
      const windowWidth = window.innerWidth;
      currentLeftRef.current = windowWidth - 400;
      currentTopRef.current = 20;
      setVisible(true);
    } else {
      setVisible(false);
    }
  }, [open]);

  useEffect(() => {
    if (visible && nodeRef.current) {
      nodeRef.current.style.left = `${currentLeftRef.current}px`;
      nodeRef.current.style.top = `${currentTopRef.current}px`;
    }
  }, [visible]);

  const handleDragStart = (e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingRef.current = true;
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      left: currentLeftRef.current,
      top: currentTopRef.current,
    };
  };

  useEffect(() => {
    if (!visible) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const deltaX = e.clientX - dragStartRef.current.mouseX;
      const deltaY = e.clientY - dragStartRef.current.mouseY;
      currentLeftRef.current = dragStartRef.current.left + deltaX;
      currentTopRef.current = dragStartRef.current.top + deltaY;
      if (nodeRef.current) {
        nodeRef.current.style.left = `${currentLeftRef.current}px`;
        nodeRef.current.style.top = `${currentTopRef.current}px`;
      }
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [visible]);

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    startSizeRef.current = { ...size };
    startCursorRef.current = { x: e.clientX, y: e.clientY };

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - startCursorRef.current.x;
      const deltaY = e.clientY - startCursorRef.current.y;
      const newWidth = Math.max(300, startSizeRef.current.width + deltaX);
      const newHeight = Math.max(300, startSizeRef.current.height + deltaY);
      setSize({ width: newWidth, height: newHeight });
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

  if (!visible) return null;

  return (
    <div
      ref={nodeRef}
      className="fixed bg-white shadow-2xl rounded-lg z-[60] flex flex-col"
      style={{
        width: size.width,
        height: size.height,
        left: currentLeftRef.current,
        top: currentTopRef.current,
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