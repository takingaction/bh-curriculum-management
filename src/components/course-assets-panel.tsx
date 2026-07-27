"use client";

import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
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
} from "lucide-react";
import { AssetLibraryModal } from "./asset-library-modal";
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

interface CourseAssetsPanelProps {
  courseId: string;
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
}

function SortableAssetItem({
  asset,
  canEdit,
  onPreview,
  onDownload,
  onRemove,
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

export function CourseAssetsPanel({ courseId, canEdit = false }: CourseAssetsPanelProps) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [previewAsset, setPreviewAsset] = useState<Asset | null>(null);

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
      const res = await fetch(`/api/courses/${courseId}/assets`);
      const data = await res.json();
      if (data.assets) {
        setAssets(data.assets);
      }
    } catch (error) {
      console.error("Failed to fetch course assets:", error);
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    if (courseId) {
      fetchAssets();
    }
  }, [courseId, fetchAssets]);

  const handleAddAsset = (asset: Asset) => {
    fetch(`/api/courses/${courseId}/assets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assetId: asset.id }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.courseAsset) {
          setAssets([...assets, asset]);
        }
      })
      .catch((error) => {
        console.error("Failed to attach asset:", error);
      });
  };

  const handleRemoveAsset = async (assetId: string) => {
    if (!confirm("Remove this resource from the course?")) return;

    try {
      const res = await fetch(`/api/courses/${courseId}/assets/${assetId}`, {
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

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    const oldIndex = assets.findIndex((a) => a.id === active.id);
    const newIndex = assets.findIndex((a) => a.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    const newAssets = arrayMove(assets, oldIndex, newIndex);
    setAssets(newAssets);

    try {
      const orderedAssetIds = newAssets.map((a) => a.id);
      await fetch(`/api/courses/${courseId}/assets/reorder`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedAssetIds }),
      });
    } catch (error) {
      console.error("Failed to reorder assets:", error);
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
        <h3 className="font-semibold text-sm text-gray-700">Course Materials</h3>
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
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <AssetLibraryModal
        open={showLibrary}
        onClose={() => setShowLibrary(false)}
        onAssetSelect={handleAddAsset}
        onAddSuccess={fetchAssets}
        selectMode={true}
      />

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
