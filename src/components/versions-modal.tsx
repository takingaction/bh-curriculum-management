"use client";

import { useState, useRef, useEffect } from "react";
import { Copy, Eye, Pencil, Trash2, Check, X, FileDown } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { LessonVersion } from "@/lib/version-utils";

interface VersionsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  versions: LessonVersion[];
  activeVersionId: string | null;
  onSelect: (version: LessonVersion) => void;
  onDelete: (versionId: string) => void;
  onRename: (versionId: string, name: string) => void;
  onCopyToNew: (versionId: string) => void;
  onGeneratePdf: (versionId: string) => void;
  onViewPdf: (versionId: string) => void;
}

export function VersionsModal({
  open,
  onOpenChange,
  versions,
  activeVersionId,
  onSelect,
  onDelete,
  onRename,
  onCopyToNew,
  onGeneratePdf,
  onViewPdf,
}: VersionsModalProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [versionToDelete, setVersionToDelete] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId]);

  useEffect(() => {
    if (!open) {
      setEditingId(null);
      setEditName("");
      setDeleteConfirmOpen(false);
      setVersionToDelete(null);
    }
  }, [open]);

  const handleStartRename = (version: LessonVersion, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(version.id);
    setEditName(version.version_name || `Version ${version.version_number}`);
  };

  const handleSaveRename = () => {
    if (editingId && editName.trim()) {
      onRename(editingId, editName.trim());
    }
    setEditingId(null);
    setEditName("");
  };

  const handleCancelRename = () => {
    setEditingId(null);
    setEditName("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSaveRename();
    } else if (e.key === "Escape") {
      handleCancelRename();
    }
  };

  const handleDeleteClick = (versionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setVersionToDelete(versionId);
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = () => {
    if (versionToDelete) {
      onDelete(versionToDelete);
    }
    setDeleteConfirmOpen(false);
    setVersionToDelete(null);
  };

  const handleCopyClick = (versionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onCopyToNew(versionId);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Versions</DialogTitle>
            <DialogDescription>
              Manage your lesson versions. Click on an entry to load it into the lesson view, or use the action buttons.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto py-4">
            {versions.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No versions yet. Use the AI chat to create one.
              </div>
            ) : (
              <div className="space-y-2">
                {versions.map((version) => (
                  <div
                    key={version.id}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg border transition-colors cursor-pointer ${
                      activeVersionId === version.id
                        ? "border-[#0d7377] bg-[#d7ffef]"
                        : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                    }`}
                    onClick={() => onSelect(version)}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {editingId === version.id ? (
                        <div className="flex items-center gap-2 flex-1" onClick={(e) => e.stopPropagation()}>
                          <input
                            ref={inputRef}
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            onKeyDown={handleKeyDown}
                            onBlur={handleSaveRename}
                            className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#0d7377]"
                          />
                          <button
                            onClick={handleSaveRename}
                            className="p-1 hover:bg-gray-200 rounded"
                            title="Save"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={handleCancelRename}
                            className="p-1 hover:bg-gray-200 rounded"
                            title="Cancel"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="flex-1 text-left min-w-0">
                            <div className="font-medium text-sm truncate">
                              {version.version_name || `Version ${version.version_number}`}
                            </div>
                            <div className="text-xs text-gray-500">
                              Created {new Date(version.created_at).toLocaleDateString()}
                            </div>
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onGeneratePdf(version.id);
                              }}
                              className="p-1.5 hover:bg-gray-200 rounded"
                              title="Generate PDF"
                            >
                              <FileDown className="w-4 h-4" />
                            </button>

                            {version.pdf_storage_path && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onViewPdf(version.id);
                                }}
                                className="p-1.5 hover:bg-gray-200 rounded"
                                title="View PDF"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                            )}

                            <button
                              onClick={(e) => handleCopyClick(version.id, e)}
                              className="p-1.5 hover:bg-gray-200 rounded"
                              title="Copy to New"
                            >
                              <Copy className="w-4 h-4" />
                            </button>

                            <button
                              onClick={(e) => handleStartRename(version, e)}
                              className="p-1.5 hover:bg-gray-200 rounded"
                              title="Rename"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>

                            <button
                              onClick={(e) => handleDeleteClick(version.id, e)}
                              className="p-1.5 hover:bg-gray-200 rounded text-red-500 hover:text-red-600"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Version?</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this version? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleConfirmDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
