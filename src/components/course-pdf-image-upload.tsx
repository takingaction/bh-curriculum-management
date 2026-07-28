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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("courseId", courseId);
    formData.append("type", "pdf");

    try {
      const res = await fetch("/api/upload/course-image", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        setImageUrl(data.imageUrl);
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

  const handleClear = async () => {
    if (!confirm("Remove PDF image?")) return;
    try {
      const res = await fetch(`/api/admin/courses/${courseId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pdf_image_url: null }),
      });
      if (res.ok) {
        setImageUrl(null);
        window.location.reload();
      }
    } catch (error) {
      alert("Failed to remove image");
    }
  };

  return (
    <div className="flex items-center gap-4">
      <div className="w-20 h-20 bg-[#d7ffef] rounded-none flex items-center justify-center overflow-hidden">
        {imageUrl ? (
          <img src={imageUrl} alt="PDF" className="w-full h-full object-cover" />
        ) : (
          <span className="text-[#666666] text-xs text-center p-2">No Image</span>
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
          {uploading ? "Uploading..." : imageUrl ? "Replace Image" : "Upload Image"}
        </Button>
        {imageUrl && (
          <button
            onClick={handleClear}
            className="block text-xs text-red-600 hover:underline ml-1"
          >
            Remove
          </button>
        )}
      </div>
    </div>
  );
}
