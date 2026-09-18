"use client";

import { useState, useCallback, useEffect, useRef } from "react";
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
  Volume2,
  DownloadIcon,
  EyeIcon,
  X,
  PlusIcon,
  TrashIcon,
  GripVertical,
  Replace,
} from "lucide-react";
import { AssetLibraryModal } from "./asset-library-modal";
import {
  isAllowedExtension,
  replaceAssetFile,
} from "@/lib/asset-replace";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface Asset {
  id: string;
  filename: string;
  display_name: string;
  public_url: string;
  file_type: string;
  asset_categories?: { name: string };
  sort_order?: number;
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
      return VideoIcon;
    case "m4a":
    case "mp3":
    case "wav":
      return Volume2;
    default:
      return FileTextIcon;
  }
}

interface SortableAssetItemProps {
  asset: Asset;
  canEdit: boolean;
  onPreview: (asset: Asset) => void;
  onDownload: (asset: Asset) => void;
  onRemove: (assetId: string) => void;
  onReplace: (asset: Asset) => void;
}

function SortableAssetItem({
  asset,
  canEdit,
  onPreview,
  onDownload,
  onRemove,
  onReplace,
}: SortableAssetItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: asset.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : "auto",
  };

  const Icon = getFileIcon(asset.file_type);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 p-2 bg-gray-50 rounded-lg group ${
        isDragging ? "shadow-lg ring-2 ring-[#0d7377]" : ""
      }`}
    >
      {canEdit && (
        <button
          type="button"
          className="p-1 hover:bg-gray-200 rounded cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600"
          {...attributes}
          {...listeners}
          title="Drag to reorder"
        >
          <GripVertical className="w-4 h-4" />
        </button>
      )}
      <div className="p-1.5 bg-white border rounded">
        <Icon className="w-4 h-4 text-gray-600" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{asset.display_name}</p>
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPreview(asset)}
          className="p-1.5 hover:bg-gray-200 rounded text-gray-600"
          title="Preview"
        >
          <EyeIcon className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => onDownload(asset)}
          className="p-1.5 hover:bg-gray-200 rounded text-gray-600"
          title="Download"
        >
          <DownloadIcon className="w-4 h-4" />
        </button>
        {canEdit && (
          <button
            type="button"
            onClick={() => onReplace(asset)}
            className="p-1.5 hover:bg-gray-200 rounded text-gray-600"
            title="Replace file (updates everywhere this resource is used)"
          >
            <Replace className="w-4 h-4" />
          </button>
        )}
        {canEdit && (
          <button
            type="button"
            onClick={() => onRemove(asset.id)}
            className="p-1.5 hover:bg-red-100 rounded text-red-600"
            title="Remove"
          >
            <TrashIcon className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

interface CompactAssetItemProps {
  asset: Asset;
  onPreview: (asset: Asset) => void;
  onDownload: (asset: Asset) => void;
}

function CompactAssetItem({ asset, onPreview, onDownload }: CompactAssetItemProps) {
  const Icon = getFileIcon(asset.file_type);
  return (
    <div className="flex items-center gap-2 py-0.5">
      <Icon className="w-3 h-3 text-gray-500 flex-shrink-0" />
      <span className="text-xs text-black truncate" title={asset.display_name}>
        {asset.display_name}
      </span>
      <div className="flex items-center gap-0.5 ml-auto">
        <button
          type="button"
          onClick={() => onPreview(asset)}
          className="p-1 hover:bg-gray-200 rounded text-gray-500"
          title="Preview"
        >
          <EyeIcon className="w-3 h-3" />
        </button>
        <button
          type="button"
          onClick={() => onDownload(asset)}
          className="p-1 hover:bg-gray-200 rounded text-gray-500"
          title="Download"
        >
          <DownloadIcon className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

export function LessonAssetsPanel({ lessonId, canEdit = false }: LessonAssetsPanelProps) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [previewAsset, setPreviewAsset] = useState<Asset | null>(null);
  const [replaceTarget, setReplaceTarget] = useState<Asset | null>(null);
  const [replaceFile, setReplaceFile] = useState<File | null>(null);
  const [replacing, setReplacing] = useState(false);
  const [replaceError, setReplaceError] = useState<string | null>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

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

  const openReplaceDialog = (asset: Asset) => {
    setReplaceTarget(asset);
    setReplaceFile(null);
    setReplaceError(null);
  };

  const closeReplaceDialog = () => {
    if (replacing) return;
    setReplaceTarget(null);
    setReplaceFile(null);
    setReplaceError(null);
    if (replaceInputRef.current) replaceInputRef.current.value = "";
  };

  const handleReplaceFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setReplaceError(null);
    if (file && !isAllowedExtension(file.name)) {
      setReplaceError("File type not allowed. Use PDF, MP4, MOV, M4A, MP3, or WAV.");
      setReplaceFile(null);
      return;
    }
    setReplaceFile(file);
  };

  const handleConfirmReplace = async () => {
    if (!replaceTarget || !replaceFile) return;
    setReplacing(true);
    setReplaceError(null);
    try {
      const result = await replaceAssetFile({
        assetId: replaceTarget.id,
        file: replaceFile,
      });
      const updatedAsset: Asset = {
        ...replaceTarget,
        filename: result.asset.filename,
        public_url: result.asset.public_url,
        file_type: result.asset.file_type,
      };
      setAssets((prev) => prev.map((a) => (a.id === updatedAsset.id ? updatedAsset : a)));
      if (previewAsset && previewAsset.id === updatedAsset.id) {
        setPreviewAsset(updatedAsset);
      }
      setReplaceTarget(null);
      setReplaceFile(null);
      if (replaceInputRef.current) replaceInputRef.current.value = "";
    } catch (err: any) {
      console.error("Replace file failed:", err);
      setReplaceError(err?.message || "Failed to replace file");
    } finally {
      setReplacing(false);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    const oldIndex = assets.findIndex((a) => a.id === active.id);
    const newIndex = assets.findIndex((a) => a.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    // Optimistically update UI
    const newAssets = arrayMove(assets, oldIndex, newIndex);
    setAssets(newAssets);

    // Send reorder request to API
    try {
      const orderedAssetIds = newAssets.map((a) => a.id);
      await fetch(`/api/lessons/${lessonId}/assets/reorder`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedAssetIds }),
      });
    } catch (error) {
      console.error("Failed to reorder assets:", error);
      // Revert on failure
      fetchAssets();
    }
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
        <h3 className="font-semibold text-sm text-gray-700">Lesson Resources</h3>
        {canEdit && (
          <Button size="sm" variant="outline" onClick={() => setShowLibrary(true)}>
            <PlusIcon className="w-4 h-4 mr-1" />
            Add Resource
          </Button>
        )}
      </div>

      {assets.length === 0 ? (
        <p className="text-sm text-gray-500 italic">No resources attached</p>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={assets.map((a) => a.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {assets.map((asset) => (
                <SortableAssetItem
                  key={asset.id}
                  asset={asset}
                  canEdit={canEdit}
                  onPreview={handlePreview}
                  onDownload={handleDownload}
                  onRemove={handleRemoveAsset}
                  onReplace={openReplaceDialog}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Curriculum Resources Modal */}
      <AssetLibraryModal
        open={showLibrary}
        onClose={() => setShowLibrary(false)}
        onAssetSelect={lessonId ? undefined : handleAddAsset}
        onAddSuccess={fetchAssets}
        lessonId={lessonId}
      />

      {/* Replace File Confirmation Modal */}
      {replaceTarget && (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-4 w-full max-w-md max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between mb-3 shrink-0">
              <h3 className="text-lg font-medium">Replace File</h3>
              <button
                type="button"
                onClick={closeReplaceDialog}
                disabled={replacing}
                className="p-1 hover:bg-gray-100 rounded disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="mb-3 text-sm text-gray-600">
              Replace the file for{" "}
              <span className="font-medium">{replaceTarget.display_name}</span>? This
              will update the file everywhere this resource is used.
            </div>
            <input
              ref={replaceInputRef}
              type="file"
              accept=".pdf,.mp4,.mov,.m4a,.mp3,.wav"
              onChange={handleReplaceFileSelected}
              className="hidden"
            />
            <div
              className="border-2 border-dashed rounded-lg p-3 text-center cursor-pointer hover:border-gray-400 mb-3 shrink-0"
              onClick={() => replaceInputRef.current?.click()}
            >
              {replaceFile ? (
                <div className="text-sm text-gray-600">
                  <span className="font-medium break-all">{replaceFile.name}</span>
                  <span className="text-xs text-gray-400 block mt-1">
                    {(replaceFile.size / 1024 / 1024).toFixed(2)} MB
                  </span>
                  <span className="text-xs text-[#0d7377] mt-2 block">Click to change</span>
                </div>
              ) : (
                <>
                  <Replace className="w-6 h-6 mx-auto mb-1 text-gray-400" />
                  <p className="text-xs text-gray-600">Click to select a replacement file</p>
                  <p className="text-xs text-gray-400">PDF, MP4, MOV, M4A, MP3, WAV</p>
                </>
              )}
            </div>
            {replaceError && (
              <div className="mb-3 p-2 bg-red-50 border border-red-200 text-red-700 text-xs rounded">
                {replaceError}
              </div>
            )}
            <div className="flex gap-2 justify-end shrink-0">
              <Button
                variant="outline"
                onClick={closeReplaceDialog}
                disabled={replacing}
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirmReplace}
                disabled={!replaceFile || replacing}
              >
                {replacing ? "Replacing..." : "Replace"}
              </Button>
            </div>
          </div>
        </div>
      )}

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
          ) : ["mp3", "m4a", "wav"].includes(previewAsset.file_type) ? (
            <div className="bg-white rounded-lg p-8 flex flex-col items-center gap-4">
              <Volume2 className="w-16 h-16 text-gray-400" />
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

interface CompactLessonAssetsProps {
  lessonId: string;
  maxItems?: number;
}

export function CompactLessonAssets({ lessonId, maxItems = 6 }: CompactLessonAssetsProps) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(false);
  const [previewAsset, setPreviewAsset] = useState<Asset | null>(null);

  useEffect(() => {
    async function fetchAssets() {
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
    }
    if (lessonId) {
      fetchAssets();
    }
  }, [lessonId]);

  const handlePreview = (asset: Asset) => {
    setPreviewAsset(asset);
  };

  const handleDownload = (asset: Asset) => {
    window.open(asset.public_url, "_blank");
  };

  if (loading) {
    return <span className="text-xs text-gray-500">Loading...</span>;
  }

  if (assets.length === 0) {
    return <span className="text-xs text-gray-400 italic">No resources</span>;
  }

  return (
    <>
      <div className="space-y-0">
        {assets.map((asset) => (
          <CompactAssetItem
            key={asset.id}
            asset={asset}
            onPreview={handlePreview}
            onDownload={handleDownload}
          />
        ))}
      </div>

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
          ) : ["mp3", "m4a", "wav"].includes(previewAsset.file_type) ? (
            <div className="bg-white rounded-lg p-8 flex flex-col items-center gap-4">
              <Volume2 className="w-16 h-16 text-gray-400" />
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
    </>
  );
}