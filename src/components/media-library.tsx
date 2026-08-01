"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { UploadIcon, TrashIcon, ImageIcon, X, Eye, RefreshCw } from "lucide-react";
import Image from "next/image";

interface CourseImage {
  id: string;
  course_id: string;
  filename: string;
  storage_path: string;
  public_url: string;
  created_at: string;
}

interface MediaLibraryProps {
  courseId: string;
  open: boolean;
  onClose: () => void;
  onImageSelect?: (imageUrl: string, imageId: string, isNew: boolean) => void;
  selectMode?: boolean;
  preSelectedImage?: CourseImage | null;
  onReplaceComplete?: () => void;
  preselectedImageUrl?: string | null;
}

export function MediaLibrary({
  courseId,
  open,
  onClose,
  onImageSelect,
  selectMode = false,
  preSelectedImage,
  onReplaceComplete,
  preselectedImageUrl,
}: MediaLibraryProps) {
  const [images, setImages] = useState<CourseImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<CourseImage | null>(null);
  const [replaceImage, setReplaceImage] = useState<CourseImage | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);
  const [preselectedUrl, setPreselectedUrl] = useState<string | null>(preselectedImageUrl || null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceFileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const fetchImages = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/course-images/${courseId}?t=${Date.now()}`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (data.images) {
        setImages(data.images);
      }
    } catch (error) {
      console.error("Failed to fetch images:", error);
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  if (open && images.length === 0 && !loading) {
    fetchImages();
  }

  useEffect(() => {
    setPreselectedUrl(preselectedImageUrl || null);
  }, [preselectedImageUrl]);

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setUploading(true);
    const uploadedUrls: string[] = [];
    const uploadedIds: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const formData = new FormData();
      formData.append("file", file);
      formData.append("courseId", courseId);

      try {
        const res = await fetch("/api/upload/lesson-image", {
          method: "POST",
          body: formData,
        });
        const data = await res.json();
        if (res.ok && data.imageUrl) {
          uploadedUrls.push(data.imageUrl);
          uploadedIds.push(data.id);
        }
      } catch (error) {
        console.error("Upload failed:", error);
      }
    }

    setUploading(false);
    fetchImages();

    if (selectMode && onImageSelect && uploadedUrls.length > 0) {
      onImageSelect(uploadedUrls[0], uploadedIds[0] || '', true);
      onClose();
    }
  };

  const handleDelete = async (image: CourseImage) => {
    if (!confirm(`Delete "${image.filename}"?`)) return;

    try {
      const res = await fetch(
        `/api/course-images/${courseId}?imageId=${image.id}&storagePath=${encodeURIComponent(image.storage_path)}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        setImages(images.filter((img) => img.id !== image.id));
        setSelectedImage(null);
      }
    } catch (error) {
      console.error("Delete failed:", error);
    }
  };

  const handleReplace = async (files: FileList | null) => {
    if (!files || files.length === 0 || !replaceImage) return;

    const file = files[0];
    const oldImage = replaceImage;

    // Delete old image from storage using REST API
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (supabaseUrl && supabaseServiceKey) {
        await fetch(
          `${supabaseUrl}/storage/v1/object/course-images/${oldImage.storage_path}`,
          {
            method: "DELETE",
            headers: {
              "Authorization": `Bearer ${supabaseServiceKey}`,
              "apikey": supabaseServiceKey,
            },
          }
        );
      }
    } catch (error) {
      console.error("Delete from storage failed:", error);
    }

    // Upload new image with existingImageId to update the record
    const formData = new FormData();
    formData.append("file", file);
    formData.append("courseId", courseId);
    formData.append("existingImageId", oldImage.id);

    try {
      const res = await fetch("/api/upload/lesson-image", {
        method: "POST",
        body: formData,
      });
      if (res.ok) {
        setNotification(`"${oldImage.filename}" replaced successfully`);
        setTimeout(() => setNotification(null), 3000);
        fetchImages();
        onReplaceComplete?.();
      }
    } catch (error) {
      console.error("Replace failed:", error);
    }
    setReplaceImage(null);
  };

  const openReplaceDialog = (image: CourseImage) => {
    setReplaceImage(image);
    replaceFileInputRef.current?.click();
  };

  const openPreview = (image: CourseImage) => {
    setSelectedImage(image);
    setShowPreview(true);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleUpload(e.dataTransfer.files);
  };

  const handleImageClick = (image: CourseImage) => {
    if (selectMode && onImageSelect) {
      onImageSelect(image.public_url, image.id, false);
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {selectMode ? "Select an Image" : "Media Library"}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          <div
            className={`border-2 border-dashed rounded-lg p-6 mb-4 text-center transition-colors ${
              isDragging
                ? "border-[#0d7377] bg-[#d7ffef]/20"
                : "border-gray-300 hover:border-gray-400"
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => handleUpload(e.target.files)}
              className="hidden"
            />
            <UploadIcon className="w-8 h-8 mx-auto mb-2 text-gray-400" />
            <p className="text-sm text-gray-600 mb-2">
              Drag and drop images here, or{" "}
              <button
                type="button"
                className="text-[#0d7377] hover:underline"
                onClick={() => fileInputRef.current?.click()}
              >
                browse
              </button>
            </p>
            <p className="text-xs text-gray-400">
              Supports: JPG, PNG, GIF, WebP
            </p>
            {uploading && (
              <p className="text-sm text-[#0d7377] mt-2">Uploading...</p>
            )}
          </div>

          {loading ? (
            <div className="text-center py-8 text-gray-500">
              Loading images...
            </div>
          ) : images.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <ImageIcon className="w-12 h-12 mx-auto mb-2 text-gray-300" />
              <p>No images uploaded yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-3 overflow-y-auto max-h-[300px]">
              {images.map((image) => (
                <div
                  key={image.id}
                  className={cn(
                    "relative group aspect-square bg-gray-100 rounded-lg overflow-hidden cursor-pointer transition-all",
                    preselectedUrl === image.public_url
                      ? "ring-2 ring-[#0d7377] ring-offset-2"
                      : ""
                  )}
                  onClick={() => handleImageClick(image)}
                >
                  <img
                    src={`${image.public_url}${image.public_url.includes('?') ? '&' : '?'}cb=${Date.now()}`}
                    alt={image.filename}
                    className="w-full h-full object-cover"
                  />
                  {/* Filename at bottom */}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                    <p className="text-white text-xs truncate">{image.filename}</p>
                  </div>
                  {/* Icon buttons at top-right */}
                  <div className="absolute top-1 right-1 flex gap-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openPreview(image);
                      }}
                      className="p-1 bg-black/50 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Preview"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openReplaceDialog(image);
                      }}
                      className="p-1 bg-black/50 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Replace"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(image);
                      }}
                      className="p-1 bg-red-500 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Delete"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {selectedImage && showPreview && (
          <div
            className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-8"
            onClick={() => {
              setShowPreview(false);
              setSelectedImage(null);
            }}
          >
            <button
              type="button"
              onClick={() => {
                setShowPreview(false);
                setSelectedImage(null);
              }}
              className="absolute top-4 right-4 p-2 bg-white hover:bg-gray-200 rounded-full text-gray-700 z-10"
            >
              <X className="w-6 h-6" />
            </button>
            <img
              src={`${selectedImage.public_url}${selectedImage.public_url.includes('?') ? '&' : '?'}cb=${Date.now()}`}
              alt={selectedImage.filename}
              className="max-w-full max-h-full object-contain bg-white"
              onClick={(e) => e.stopPropagation()}
            />
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white rounded-lg px-4 py-2 text-sm text-gray-700">
              {selectedImage.filename}
            </div>
          </div>
        )}

        {/* Hidden file input for replace */}
        <input
          ref={replaceFileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => handleReplace(e.target.files)}
        />

        {/* Notification toast */}
        {notification && (
          <div className="fixed bottom-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-[100]">
            {notification}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
