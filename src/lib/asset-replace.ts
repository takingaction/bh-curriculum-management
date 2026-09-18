"use client";

export const ALLOWED_REPLACE_EXTENSIONS = ["pdf", "mp4", "mov", "m4a", "mp3", "wav"];

export interface ReplaceFileArgs {
  assetId: string;
  file: File;
}

export interface ReplaceFileResult {
  storagePath: string;
  publicUrl: string;
  filename: string;
  fileType: string;
  fileSize: number;
  asset: {
    id: string;
    filename: string;
    display_name: string;
    storage_path: string;
    public_url: string;
    file_type: string;
    file_size: number;
    category_id: string | null;
    asset_categories?: { name: string } | null;
  };
}

export function getFileExtension(filename: string): string {
  const idx = filename.lastIndexOf(".");
  return idx >= 0 ? filename.slice(idx + 1).toLowerCase() : "";
}

export function isAllowedExtension(filename: string): boolean {
  return ALLOWED_REPLACE_EXTENSIONS.includes(getFileExtension(filename));
}

export async function replaceAssetFile({
  assetId,
  file,
}: ReplaceFileArgs): Promise<ReplaceFileResult> {
  if (!isAllowedExtension(file.name)) {
    throw new Error(
      `File type not allowed. Allowed: ${ALLOWED_REPLACE_EXTENSIONS.join(", ")}`
    );
  }

  const fileType = getFileExtension(file.name);

  const urlRes = await fetch("/api/assets/upload-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      filename: file.name,
      fileType,
      fileSize: file.size,
    }),
  });

  const urlData = await urlRes.json();
  if (!urlRes.ok) {
    throw new Error(urlData.error || "Failed to get upload URL");
  }

  const uploadRes = await fetch(urlData.uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": file.type || "application/octet-stream",
    },
    body: file,
  });

  if (!uploadRes.ok) {
    throw new Error("Failed to upload file to storage");
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const publicUrl = `${supabaseUrl}/storage/v1/object/public/curriculum-assets/${urlData.storagePath}`;

  const updateRes = await fetch(`/api/assets/${assetId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      storagePath: urlData.storagePath,
      publicUrl,
      filename: file.name,
      fileType,
      fileSize: file.size,
    }),
  });

  const updateData = await updateRes.json();
  if (!updateRes.ok) {
    throw new Error(updateData.error || "Failed to update asset record");
  }

  return {
    storagePath: urlData.storagePath,
    publicUrl,
    filename: file.name,
    fileType,
    fileSize: file.size,
    asset: updateData.asset,
  };
}
