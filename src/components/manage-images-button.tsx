"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MediaLibrary } from "@/components/media-library";
import { ImageIcon } from "lucide-react";

interface ManageImagesButtonProps {
  courseId: string;
  imageCount?: number;
}

export function ManageImagesButton({ courseId, imageCount }: ManageImagesButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <ImageIcon className="w-4 h-4 mr-1" />
        {imageCount !== undefined ? `${imageCount} images` : "Manage Images"}
      </Button>
      <MediaLibrary courseId={courseId} open={open} onClose={() => setOpen(false)} />
    </>
  );
}
