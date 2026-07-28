"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";

interface CoursePdfImageUploadProps {
  courseId: string;
  currentImageUrl: string | null;
}

export function CoursePdfImageUpload({ courseId, currentImageUrl }: CoursePdfImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [imageUrl, setImageUrl] = useState(currentImageUrl);
  const [urlInput, setUrlInput] = useState(currentImageUrl || "");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("courseId", courseId);
    formData.append("type", "pdf"); // distinguishes this upload

    try {
      const res = await fetch("/api/upload/course-image", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        setImageUrl(data.imageUrl);
        setUrlInput(data.imageUrl);
        // Update via API
        await fetch(`/api/admin/courses/${courseId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pdf_image_url: data.imageUrl }),
        });
        window.location.reload();
      } else {
        alert(data.error || "Upload failed");
      }
    } catch (error) {
      alert("Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleUrlSubmit = async () => {
    if (!urlInput.trim()) return;

    setUploading(true);
    try {
      const res = await fetch(`/api/admin/courses/${courseId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pdf_image_url: urlInput.trim() }),
      });
      if (res.ok) {
        setImageUrl(urlInput.trim());
        window.location.reload();
      } else {
        alert("Failed to save URL");
      }
    } catch (error) {
      alert("Failed to save URL");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex items-center gap-4">
      <div className="w-20 h-20 bg-[#d7ffef] rounded-none flex items-center justify-center overflow-hidden">
        {imageUrl ? (
          <img src={imageUrl} alt="PDF" className="w-full h-full object-cover" />
        ) : (
          <span className="text-[#666666] text-xs text-center p-2">No PDF Image</span>
        )}
      </div>
      <div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="border-[#e5e5e0] mb-2"
        >
          {uploading ? "Uploading..." : "Upload PDF Image"}
        </Button>
        <div className="flex gap-2">
          <input
            type="text"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="Or paste image URL"
            className="text-xs border border-gray-300 rounded px-2 py-1 w-40"
          />
          <button
            onClick={handleUrlSubmit}
            disabled={uploading || !urlInput.trim()}
            className="text-xs bg-[#0d7377] text-white px-2 py-1 rounded hover:bg-[#0a5c5f] disabled:opacity-50"
          >
            Save URL
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-1">Used for PDF title page</p>
      </div>
    </div>
  );
}
