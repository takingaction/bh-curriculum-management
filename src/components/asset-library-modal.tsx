"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  UploadIcon,
  TrashIcon,
  FileTextIcon,
  VideoIcon,
  MusicIcon,
  DownloadIcon,
  EyeIcon,
  X,
  PlusIcon,
  CheckIcon,
  EditIcon,
  SearchIcon,
  FolderIcon,
} from "lucide-react";

interface AssetCategory {
  id: string;
  name: string;
  sort_order: number;
  created_at: string;
}

interface Asset {
  id: string;
  category_id: string | null;
  filename: string;
  display_name: string;
  storage_path: string;
  public_url: string;
  file_type: string;
  file_size: number;
  created_at: string;
  asset_categories?: { name: string };
}

interface AssetLibraryModalProps {
  open: boolean;
  onClose: () => void;
  onAssetSelect?: (asset: Asset) => void;
  selectMode?: boolean;
  lessonId?: string;
}

const FILE_TYPES = [
  { value: "pdf", label: "PDF", icon: FileTextIcon },
  { value: "mp4", label: "MP4", icon: VideoIcon },
  { value: "mov", label: "MOV", icon: VideoIcon },
  { value: "m4a", label: "M4A", icon: MusicIcon },
  { value: "mp3", label: "MP3", icon: MusicIcon },
];

function getFileIcon(fileType: string) {
  const ft = FILE_TYPES.find((f) => f.value === fileType.toLowerCase());
  return ft?.icon || FileTextIcon;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

export function AssetLibraryModal({
  open,
  onClose,
  onAssetSelect,
  selectMode = false,
  lessonId,
}: AssetLibraryModalProps) {
  const [categories, setCategories] = useState<AssetCategory[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedFileTypes, setSelectedFileTypes] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewAsset, setPreviewAsset] = useState<Asset | null>(null);
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState("");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploadDisplayNames, setUploadDisplayNames] = useState<Record<string, string>>({});
  const [uploadCategoryId, setUploadCategoryId] = useState<string | null>(null);
  const [editingAssetId, setEditingAssetId] = useState<string | null>(null);
  const [editingAssetName, setEditingAssetName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch("/api/asset-categories");
      const data = await res.json();
      if (data.categories) {
        setCategories(data.categories);
      }
    } catch (error) {
      console.error("Failed to fetch categories:", error);
    }
  }, []);

  const fetchAssets = useCallback(async () => {
    setLoading(true);
    try {
      let url = "/api/assets?";
      if (selectedCategory) url += `category=${selectedCategory}&`;
      if (search) url += `search=${encodeURIComponent(search)}&`;
      if (selectedFileTypes.length > 0) {
        url += `fileType=${selectedFileTypes[0]}&`;
      }

      const res = await fetch(url);
      const data = await res.json();
      if (data.assets) {
        setAssets(data.assets);
      }
    } catch (error) {
      console.error("Failed to fetch assets:", error);
    } finally {
      setLoading(false);
    }
  }, [selectedCategory, search, selectedFileTypes]);

  useEffect(() => {
    if (open) {
      fetchCategories();
      fetchAssets();
    }
  }, [open, fetchCategories, fetchAssets]);

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) return;
    try {
      const res = await fetch("/api/asset-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newCategoryName }),
      });
      if (res.ok) {
        setNewCategoryName("");
        setShowAddCategory(false);
        fetchCategories();
      }
    } catch (error) {
      console.error("Failed to add category:", error);
    }
  };

  const handleUpdateCategory = async (id: string) => {
    if (!editingCategoryName.trim()) return;
    try {
      const res = await fetch(`/api/asset-categories/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editingCategoryName }),
      });
      if (res.ok) {
        setEditingCategory(null);
        setEditingCategoryName("");
        fetchCategories();
      }
    } catch (error) {
      console.error("Failed to update category:", error);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm("Delete this category? Resources will be unlinked but not deleted.")) return;
    try {
      const res = await fetch(`/api/asset-categories/${id}`, { method: "DELETE" });
      if (res.ok) {
        if (selectedCategory === id) setSelectedCategory(null);
        fetchCategories();
      }
    } catch (error) {
      console.error("Failed to delete category:", error);
    }
  };

  const handleUploadClick = () => {
    if (!selectedCategory) {
      alert("Please select a category first");
      return;
    }
    setUploadCategoryId(selectedCategory);
    setUploadFiles([]);
    setUploadDisplayNames({});
    setShowUploadModal(true);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      setUploadFiles(files);
      const names: Record<string, string> = {};
      files.forEach((f) => {
        names[f.name] = f.name.replace(/\.[^/.]+$/, "");
      });
      setUploadDisplayNames(names);
    }
  };

  const handleUpload = async () => {
    if (uploadFiles.length === 0 || !uploadCategoryId) return;

    setUploading(true);
    let successCount = 0;
    let failCount = 0;

    try {
      for (const uploadFile of uploadFiles) {
        const ext = uploadFile.name.split(".").pop()?.toLowerCase() || "";
        const fileType = ext;
        const displayName = uploadDisplayNames[uploadFile.name] || uploadFile.name;

        const urlRes = await fetch("/api/assets/upload-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filename: uploadFile.name,
            fileType,
            fileSize: uploadFile.size,
            categoryId: uploadCategoryId,
          }),
        });

        const urlData = await urlRes.json();
        if (!urlRes.ok) {
          console.error("Failed to get upload URL for", uploadFile.name);
          failCount++;
          continue;
        }

        const uploadRes = await fetch(urlData.uploadUrl, {
          method: "PUT",
          headers: {
            "Content-Type": uploadFile.type,
          },
          body: uploadFile,
        });

        if (!uploadRes.ok) {
          console.error("Upload failed for", uploadFile.name);
          failCount++;
          continue;
        }

        const publicUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/curriculum-assets/${urlData.storagePath}`;

        const confirmRes = await fetch("/api/assets/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filename: uploadFile.name,
            displayName: displayName,
            storagePath: urlData.storagePath,
            publicUrl: publicUrl,
            fileType,
            fileSize: uploadFile.size,
            categoryId: uploadCategoryId,
          }),
        });

        if (confirmRes.ok) {
          successCount++;
        } else {
          failCount++;
        }
      }

      if (successCount > 0) {
        setShowUploadModal(false);
        setUploadFiles([]);
        setUploadDisplayNames({});
        fetchAssets();
      }

      if (failCount > 0) {
        alert(`Uploaded ${successCount} file(s), failed ${failCount}`);
      } else if (successCount > 0) {
        alert(`Uploaded ${successCount} file(s) successfully`);
      }
    } catch (error) {
      console.error("Upload failed:", error);
      alert("Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteAsset = async (asset: Asset) => {
    if (!confirm(`Delete "${asset.display_name}"?`)) return;
    try {
      const res = await fetch(`/api/assets/${asset.id}`, { method: "DELETE" });
      if (res.ok) {
        setAssets(assets.filter((a) => a.id !== asset.id));
        setPreviewAsset(null);
      }
    } catch (error) {
      console.error("Failed to delete asset:", error);
    }
  };

  const handleRenameAsset = async (asset: Asset) => {
    if (!editingAssetName.trim()) return;
    try {
      const res = await fetch(`/api/assets/${asset.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ display_name: editingAssetName.trim() }),
      });
      if (res.ok) {
        setAssets(assets.map(a => a.id === asset.id ? { ...a, display_name: editingAssetName.trim() } : a));
        setPreviewAsset({ ...previewAsset!, display_name: editingAssetName.trim() } as Asset);
        setEditingAssetId(null);
        setEditingAssetName("");
      }
    } catch (error) {
      console.error("Failed to rename asset:", error);
    }
  };

  const startRename = (asset: Asset) => {
    setEditingAssetId(asset.id);
    setEditingAssetName(asset.display_name);
  };

  const handleAssetClick = (asset: Asset) => {
    if (lessonId) {
      setPreviewAsset(asset);
    } else if (selectMode && onAssetSelect) {
      onAssetSelect(asset);
      onClose();
    } else {
      setPreviewAsset(asset);
    }
  };

  const handleDownload = (asset: Asset) => {
    window.open(asset.public_url, "_blank");
  };

  const handlePreview = (asset: Asset) => {
    window.open(asset.public_url, "_blank");
  };

  const handleAddToLesson = async (asset: Asset) => {
    if (!lessonId) return;
    try {
      const res = await fetch(`/api/lessons/${lessonId}/assets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetId: asset.id }),
      });
      if (res.ok) {
        alert(`"${asset.display_name}" added to lesson`);
        setPreviewAsset(null);
      } else {
        const data = await res.json();
        alert(data.error || "Failed to add asset to lesson");
      }
    } catch (error) {
      console.error("Failed to add asset:", error);
      alert("Failed to add asset to lesson");
    }
  };

  const toggleFileType = (type: string) => {
    setSelectedFileTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [type]
    );
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] flex flex-col p-6">
        <DialogHeader>
          <DialogTitle>
            {selectMode ? "Select a Resource" : "Curriculum Resources"}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-1 overflow-hidden gap-4">
          {/* Left Sidebar - Categories */}
          <div className="w-48 flex-shrink-0 border-r pr-4 overflow-y-auto">
            <div className="space-y-1">
              <button
                type="button"
                onClick={() => setSelectedCategory(null)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm ${
                  selectedCategory === null
                    ? "bg-[#0d7377] text-white"
                    : "hover:bg-gray-100"
                }`}
              >
                All Assets
              </button>
              {categories.map((cat) => (
                <div key={cat.id} className="group relative">
                  {editingCategory === cat.id ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        value={editingCategoryName}
                        onChange={(e) => setEditingCategoryName(e.target.value)}
                        className="flex-1 px-2 py-1 text-sm border rounded"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleUpdateCategory(cat.id);
                          if (e.key === "Escape") setEditingCategory(null);
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => handleUpdateCategory(cat.id)}
                        className="p-1 text-green-600"
                      >
                        <CheckIcon className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div
                      onClick={() => setSelectedCategory(cat.id)}
                      className={`w-full px-3 py-2 rounded-lg text-sm flex items-center justify-between cursor-pointer ${
                        selectedCategory === cat.id
                          ? "bg-[#0d7377] text-white"
                          : "hover:bg-gray-100"
                      }`}
                    >
                      <span className="truncate">{cat.name}</span>
                      {!selectMode && (
                        <span className="hidden group-hover:flex items-center gap-1">
                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingCategory(cat.id);
                              setEditingCategoryName(cat.name);
                            }}
                            className="p-1 hover:bg-gray-200 rounded cursor-pointer"
                          >
                            <EditIcon className="w-3 h-3" />
                          </span>
                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteCategory(cat.id);
                            }}
                            className="p-1 hover:bg-red-100 text-red-600 rounded cursor-pointer"
                          >
                            <TrashIcon className="w-3 h-3" />
                          </span>
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
              {showAddCategory ? (
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="Category name"
                    className="flex-1 px-2 py-1 text-sm border rounded"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleAddCategory();
                      if (e.key === "Escape") {
                        setShowAddCategory(false);
                        setNewCategoryName("");
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleAddCategory}
                    className="p-1 text-green-600"
                  >
                    <CheckIcon className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                !selectMode && (
                  <button
                    type="button"
                    onClick={() => setShowAddCategory(true)}
                    className="w-full text-left px-3 py-2 rounded-lg text-sm text-gray-500 hover:bg-gray-100 flex items-center gap-2"
                  >
                    <PlusIcon className="w-4 h-4" />
                    Add Category
                  </button>
                )
              )}
            </div>
          </div>

{/* Main Content - Assets */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Search and Filters */}
            <div className="flex items-center gap-4 mb-4">
              <div className="relative flex-1">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Search resources..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex items-center gap-2">
                {FILE_TYPES.map((ft) => (
                  <button
                    key={ft.value}
                    type="button"
                    onClick={() => toggleFileType(ft.value)}
                    className={`px-3 py-1 text-xs rounded-full border ${
                      selectedFileTypes.includes(ft.value)
                        ? "bg-[#0d7377] text-white border-[#0d7377]"
                        : "border-gray-300 hover:border-gray-400"
                    }`}
                  >
                    {ft.label}
                  </button>
                ))}
              </div>
              <Button onClick={handleUploadClick} disabled={!selectedCategory}>
                  <UploadIcon className="w-4 h-4 mr-1" />
                  Upload Resource
              </Button>
            </div>

            {/* Preview Panel */}
            {previewAsset && (
              <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-medium text-sm">Selected Resource</h3>
                  <button
                    type="button"
                    onClick={() => setPreviewAsset(null)}
                    className="p-1 hover:bg-gray-200 rounded"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-white rounded">
                    {(() => {
                      const Icon = getFileIcon(previewAsset.file_type);
                      return <Icon className="w-8 h-8 text-gray-600" />;
                    })()}
                  </div>
                  <div className="flex-1">
                    {editingAssetId === previewAsset.id ? (
                      <div className="flex items-center gap-2">
                        <Input
                          type="text"
                          value={editingAssetName}
                          onChange={(e) => setEditingAssetName(e.target.value)}
                          className="flex-1"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleRenameAsset(previewAsset);
                            if (e.key === "Escape") {
                              setEditingAssetId(null);
                              setEditingAssetName("");
                            }
                          }}
                        />
                        <Button
                          size="sm"
                          onClick={() => handleRenameAsset(previewAsset)}
                        >
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingAssetId(null);
                            setEditingAssetName("");
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{previewAsset.display_name}</p>
                        {!selectMode && (
                          <button
                            type="button"
                            onClick={() => startRename(previewAsset)}
                            className="p-1 hover:bg-gray-200 rounded"
                            title="Rename"
                          >
                            <EditIcon className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    )}
                    <p className="text-xs text-gray-500 mt-1">
                      {previewAsset.file_type.toUpperCase()} • {formatFileSize(previewAsset.file_size)}
                    </p>
                    {previewAsset.asset_categories && (
                      <p className="text-xs text-[#0d7377] mt-1">
                        {previewAsset.asset_categories.name}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {lessonId && (
                      <Button
                        onClick={() => handleAddToLesson(previewAsset)}
                        size="sm"
                      >
                        <PlusIcon className="w-4 h-4 mr-1" />
                        Add to Lesson
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePreview(previewAsset)}
                    >
                      <EyeIcon className="w-4 h-4 mr-1" />
                      Preview
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownload(previewAsset)}
                    >
                      <DownloadIcon className="w-4 h-4 mr-1" />
                      Download
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteAsset(previewAsset)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Asset Grid */}
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="text-center py-12 text-gray-500">
                  Loading assets...
                </div>
              ) : assets.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <FolderIcon className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                  <p>No resources found</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {assets.map((asset) => {
                    const Icon = getFileIcon(asset.file_type);
                    const isSelected = previewAsset?.id === asset.id;
                    return (
                      <div
                        key={asset.id}
                        className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                          isSelected
                            ? "border-[#0d7377] bg-[#f0fdfa]"
                            : "hover:border-[#0d7377]"
                        }`}
                        onClick={() => handleAssetClick(asset)}
                      >
                        <div className="flex items-start gap-3">
                          <div className="p-2 bg-gray-100 rounded">
                            <Icon className="w-6 h-6 text-gray-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">
                              {asset.display_name}
                            </p>
                            <p className="text-xs text-gray-500">
                              {asset.file_type.toUpperCase()}
                            </p>
                            {asset.asset_categories && (
                              <p className="text-xs text-[#0d7377]">
                                {asset.asset_categories.name}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Upload Modal */}
        {showUploadModal && (
          <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium">
                  Upload to{" "}
                  {categories.find((c) => c.id === uploadCategoryId)?.name || "Category"}
                </h3>
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="p-1 hover:bg-gray-100 rounded"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <input
                ref={uploadInputRef}
                type="file"
                accept=".pdf,.mp4,.mov,.m4a,.mp3"
                multiple
                onChange={handleFileSelect}
                className="hidden"
              />
              <div
                className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-gray-400 mb-4"
                onClick={() => uploadInputRef.current?.click()}
              >
                {uploadFiles.length > 0 ? (
                  <div className="space-y-2">
                    {uploadFiles.map((f, i) => (
                      <div key={i} className="flex items-center justify-center gap-2">
                        {(() => {
                          const Icon = getFileIcon(f.name.split(".").pop() || "");
                          return <Icon className="w-5 h-5 text-gray-400" />;
                        })()}
                        <span className="text-sm">{f.name}</span>
                        <span className="text-xs text-gray-400">({formatFileSize(f.size)})</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <>
                    <UploadIcon className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                    <p className="text-sm text-gray-600">
                      Click to select files
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      PDF, MP4, MOV, M4A, MP3
                    </p>
                  </>
                )}
              </div>
              {uploadFiles.length > 0 && (
                <div className="mb-4 space-y-3">
                  <label className="text-sm text-gray-600 mb-1 block">
                    Display Names (optional)
                  </label>
                  {uploadFiles.map((f, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 w-32 truncate">{f.name}</span>
                      <Input
                        type="text"
                        value={uploadDisplayNames[f.name] || ""}
                        onChange={(e) => setUploadDisplayNames(prev => ({ ...prev, [f.name]: e.target.value }))}
                        placeholder="Display name"
                        className="flex-1"
                      />
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  onClick={() => setShowUploadModal(false)}
                >
                  Cancel
                </Button>
                <Button onClick={handleUpload} disabled={uploadFiles.length === 0 || uploading}>
                  {uploading ? "Uploading..." : "Upload Resources"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
