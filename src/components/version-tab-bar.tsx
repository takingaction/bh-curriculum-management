"use client";

import { useState, useRef, useEffect } from "react";
import { FileDown, Eye, Pencil, Trash2, Check, X } from "lucide-react";
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

interface VersionTabBarProps {
  versions: LessonVersion[];
  activeVersionId: string | null;
  onSelect: (version: LessonVersion) => void;
  onDelete: (versionId: string) => void;
  onRename: (versionId: string, name: string) => void;
  onGeneratePdf: (versionId: string) => void;
  onViewPdf: (versionId: string) => void;
}

export function VersionTabBar({
  versions,
  activeVersionId,
  onSelect,
  onDelete,
  onRename,
  onGeneratePdf,
  onViewPdf,
}: VersionTabBarProps) {
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

  const handleStartRename = (version: LessonVersion, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(version.id);
    setEditName(version.version_name || `Version ${version.version_number}`);
  };

  const handleSaveRename = (versionId: string) => {
    if (editName.trim()) {
      onRename(versionId, editName.trim());
    }
    setEditingId(null);
    setEditName("");
  };

  const handleCancelRename = () => {
    setEditingId(null);
    setEditName("");
  };

  const handleKeyDown = (e: React.KeyboardEvent, versionId: string) => {
    if (e.key === "Enter") {
      handleSaveRename(versionId);
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

  if (versions.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium text-gray-500">Versions:</span>

      {versions.map((version) => (
        <div
          key={version.id}
          className={`group relative flex flex-col gap-1 px-2 py-1.5 rounded text-xs cursor-pointer transition-colors ${
            activeVersionId === version.id
              ? "bg-[#0d7377] text-white"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
          onClick={() => onSelect(version)}
        >
          {editingId === version.id ? (
            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
              <input
                ref={inputRef}
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, version.id)}
                onBlur={() => handleSaveRename(version.id)}
                className="w-24 px-1 py-0.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-[#0d7377]"
              />
              <button
                onClick={() => handleSaveRename(version.id)}
                className="p-0.5 hover:bg-black/10 rounded"
                title="Save"
              >
                <Check className="w-3 h-3" />
              </button>
              <button
                onClick={handleCancelRename}
                className="p-0.5 hover:bg-black/10 rounded"
                title="Cancel"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <span className="truncate">
                  {version.version_name || `Version ${version.version_number}`}
                </span>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onGeneratePdf(version.id);
                  }}
                  className="p-0.5 rounded hover:bg-black/10"
                  title="Generate PDF"
                >
                  <FileDown className="w-3 h-3" />
                </button>

                {version.pdf_storage_path ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onViewPdf(version.id);
                    }}
                    className="p-0.5 rounded hover:bg-black/10"
                    title="View PDF"
                  >
                    <Eye className="w-3 h-3" />
                  </button>
                ) : null}

                <button
                  onClick={(e) => handleStartRename(version, e)}
                  className="p-0.5 rounded hover:bg-black/10"
                  title="Rename"
                >
                  <Pencil className="w-3 h-3" />
                </button>

                <button
                  onClick={(e) => handleDeleteClick(version.id, e)}
                  className="p-0.5 rounded hover:bg-black/10"
                  title="Delete"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </>
          )}
        </div>
      ))}

      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="w-[90%] md:w-[50%] md:max-w-[50%]">
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
    </div>
  );
}
