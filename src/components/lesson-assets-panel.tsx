"use client";

import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  FileTextIcon,
  VideoIcon,
  MusicIcon,
  DownloadIcon,
  EyeIcon,
  X,
  PlusIcon,
  TrashIcon,
} from "lucide-react";
import { AssetLibraryModal } from "./asset-library-modal";

interface Asset {
  id: string;
  filename: string;
  display_name: string;
  public_url: string;
  file_type: string;
  asset_categories?: { name: string };
}

interface LessonAssetsPanelProps {
  lessonId: string;
  canEdit?: boolean;
}

function getFileIcon(fileType: string) {
  switch (fileType.toLowerCase()) {
    case "pdf":
      return FileTextIcon;
    case "mp4":
    case "mov":
    case "m4a":
      return VideoIcon;
    case "mp3":
      return MusicIcon;
    default:
      return FileTextIcon;
  }
}

export function LessonAssetsPanel({ lessonId, canEdit = false }: LessonAssetsPanelProps) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [previewAsset, setPreviewAsset] = useState<Asset | null>(null);

  const fetchAssets = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/lessons/${lessonId}/assets`);
      const data = await res.json();
      if (data.assets) {
        setAssets(data.assets);
      }
    } catch (error) {
      console.error("Failed to fetch lesson assets:", error);
    } finally {
      setLoading(false);
    }
  }, [lessonId]);

  useEffect(() => {
    if (lessonId) {
      fetchAssets();
    }
  }, [lessonId, fetchAssets]);

  const handleAddAsset = (asset: Asset) => {
    // Attach asset to lesson
    fetch(`/api/lessons/${lessonId}/assets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assetId: asset.id }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.lessonAsset) {
          setAssets([...assets, asset]);
        }
      })
      .catch((error) => {
        console.error("Failed to attach asset:", error);
      });
  };

  const handleRemoveAsset = async (assetId: string) => {
    if (!confirm("Remove this asset from the lesson?")) return;

    try {
      const res = await fetch(`/api/lessons/${lessonId}/assets/${assetId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setAssets(assets.filter((a) => a.id !== assetId));
      }
    } catch (error) {
      console.error("Failed to remove asset:", error);
    }
  };

  const handleDownload = (asset: Asset) => {
    window.open(asset.public_url, "_blank");
  };

  const handlePreview = (asset: Asset) => {
    setPreviewAsset(asset);
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <div className="animate-spin w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full" />
        Loading assets...
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm text-gray-700">Lesson Materials</h3>
        {canEdit && (
          <Button size="sm" variant="outline" onClick={() => setShowLibrary(true)}>
            <PlusIcon className="w-4 h-4 mr-1" />
            Add Resource
          </Button>
        )}
      </div>

      {assets.length === 0 ? (
        <p className="text-sm text-gray-500 italic">No materials attached</p>
      ) : (
        <div className="space-y-2">
          {assets.map((asset) => {
            const Icon = getFileIcon(asset.file_type);
            return (
              <div
                key={asset.id}
                className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg group"
              >
                <div className="p-1.5 bg-white border rounded">
                  <Icon className="w-4 h-4 text-gray-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{asset.display_name}</p>
                  {asset.asset_categories && (
                    <p className="text-xs text-gray-500">{asset.asset_categories.name}</p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handlePreview(asset)}
                    className="p-1.5 hover:bg-gray-200 rounded text-gray-600"
                    title="Preview"
                  >
                    <EyeIcon className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownload(asset)}
                    className="p-1.5 hover:bg-gray-200 rounded text-gray-600"
                    title="Download"
                  >
                    <DownloadIcon className="w-4 h-4" />
                  </button>
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => handleRemoveAsset(asset.id)}
                      className="p-1.5 hover:bg-red-100 rounded text-red-600"
                      title="Remove"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Curriculum Resources Modal */}
      <AssetLibraryModal
        open={showLibrary}
        onClose={() => setShowLibrary(false)}
        selectMode
        onAssetSelect={handleAddAsset}
        lessonId={lessonId}
      />

      {/* Preview Modal */}
      {previewAsset && (
        <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-8">
          <div className="absolute top-4 right-4 flex gap-2">
            <button
              type="button"
              onClick={() => handleDownload(previewAsset)}
              className="p-2 bg-white rounded-full hover:bg-gray-100"
            >
              <DownloadIcon className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => setPreviewAsset(null)}
              className="p-2 bg-white rounded-full hover:bg-gray-100"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          {previewAsset.file_type === "pdf" ? (
            <iframe
              src={previewAsset.public_url}
              className="w-full h-full max-w-4xl max-h-full bg-white"
              title={previewAsset.display_name}
            />
          ) : ["mp4", "mov", "m4a"].includes(previewAsset.file_type) ? (
            <video
              src={previewAsset.public_url}
              controls
              autoPlay
              className="max-w-full max-h-full"
            />
          ) : ["mp3"].includes(previewAsset.file_type) ? (
            <div className="bg-white rounded-lg p-8 flex flex-col items-center gap-4">
              <MusicIcon className="w-16 h-16 text-gray-400" />
              <p className="text-lg font-medium">{previewAsset.display_name}</p>
              <audio
                src={previewAsset.public_url}
                controls
                autoPlay
                className="w-64"
              />
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
