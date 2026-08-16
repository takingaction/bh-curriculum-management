"use client";

import { useState } from "react";
import { FileText, Eye, FileDown, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import type { LessonVersion } from "@/lib/version-utils";
import { getVersionDisplayName, REASON_LABELS, type ModificationReason } from "@/lib/version-utils";
import { VersionPreview } from "./version-preview";
import { GeneratePdfDialog } from "./generate-pdf-dialog";

interface VersionTabsProps {
  lessonId: string;
  versions: LessonVersion[];
  activeVersionId: string | null;
  onSelectVersion: (version: LessonVersion) => void;
  onCreateNew: () => void;
  onDeleteVersion: (versionId: string) => void;
  onUseVersion: (version: LessonVersion) => void;
  maxVersions?: number;
  canCreate?: boolean;
}

export function VersionTabs({
  lessonId,
  versions,
  activeVersionId,
  onSelectVersion,
  onCreateNew,
  onDeleteVersion,
  onUseVersion,
  maxVersions = 3,
  canCreate = true,
}: VersionTabsProps) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<LessonVersion | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [versionToDelete, setVersionToDelete] = useState<string | null>(null);
  const [pdfDialogOpen, setPdfDialogOpen] = useState(false);
  const [pdfVersion, setPdfVersion] = useState<LessonVersion | null>(null);

  const canAddNew = canCreate && versions.length < maxVersions;

  const handleTabClick = (version: LessonVersion) => {
    setSelectedVersion(version);
    setPreviewOpen(true);
  };

  const handleGeneratePdf = (version: LessonVersion, e: React.MouseEvent) => {
    console.log("[VersionTabs] handleGeneratePdf called, version:", version.id);
    e.stopPropagation();
    setPdfVersion(version);
    setPdfDialogOpen(true);
  };

  const handleViewPdf = (version: LessonVersion, e: React.MouseEvent) => {
    e.stopPropagation();
    if (version.pdf_storage_path) {
      const url = `/api/lessons/${lessonId}/versions/${version.id}/pdf?cb=${Date.now()}`;
      window.open(url, "_blank");
    }
  };

  const handleConfirmDelete = (versionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setVersionToDelete(versionId);
    setDeleteConfirmOpen(true);
  };

  const handleDelete = () => {
    if (versionToDelete) {
      onDeleteVersion(versionToDelete);
      setVersionToDelete(null);
    }
    setDeleteConfirmOpen(false);
  };

  return (
    <>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-medium text-gray-500 mr-1">Versions:</span>

        {versions.map((version) => (
          <div
            key={version.id}
            className={`group relative flex items-center gap-1 px-2 py-1 rounded text-xs font-medium cursor-pointer transition-colors ${
              activeVersionId === version.id
                ? "bg-[#0d7377] text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
            onClick={() => handleTabClick(version)}
          >
            <span className="truncate max-w-[120px]">
              {version.version_name || `Version ${version.version_number}`}
            </span>

            {version.is_approved && (
              <Check className="w-3 h-3 flex-shrink-0 text-green-500" />
            )}

            <div className="flex items-center gap-0.5 ml-1">
              <button
                onClick={(e) => handleGeneratePdf(version, e)}
                className="p-0.5 rounded hover:bg-black/10"
                title="Generate PDF"
              >
                <FileDown className="w-3 h-3" />
              </button>

              {version.pdf_storage_path ? (
                <button
                  onClick={(e) => handleViewPdf(version, e)}
                  className="p-0.5 rounded hover:bg-black/10"
                  title="View PDF"
                >
                  <Eye className="w-3 h-3" />
                </button>
              ) : (
                <span className="w-3 h-3" />
              )}

              <button
                onClick={(e) => handleConfirmDelete(version.id, e)}
                className="p-0.5 rounded hover:bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity"
                title="Delete version"
              >
                <span className="text-red-500 text-xs">×</span>
              </button>
            </div>
          </div>
        ))}

        {canAddNew && (
          <button
            onClick={onCreateNew}
            className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-[#e85d5d] text-white hover:bg-[#d44d4d] transition-colors"
          >
            <span>+</span>
            <span>New</span>
          </button>
        )}
      </div>

      {selectedVersion && (
        <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
          <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                {getVersionDisplayName(selectedVersion)}
                {selectedVersion.modification_reason && (
                  <span className="text-xs bg-gray-100 px-2 py-0.5 rounded-full font-normal">
                    {REASON_LABELS[selectedVersion.modification_reason as ModificationReason]}
                  </span>
                )}
                {selectedVersion.is_approved && (
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-normal flex items-center gap-1">
                    <Check className="w-3 h-3" /> Approved
                  </span>
                )}
              </DialogTitle>
              <DialogDescription>
                Created {new Date(selectedVersion.created_at).toLocaleDateString()}
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto">
              <VersionPreview version={selectedVersion} />
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setPreviewOpen(false);
                  onUseVersion(selectedVersion);
                }}
              >
                Use This Version
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  setPreviewOpen(false);
                  setVersionToDelete(selectedVersion.id);
                  setDeleteConfirmOpen(true);
                }}
              >
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

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
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {pdfVersion && (
        <GeneratePdfDialog
          open={pdfDialogOpen}
          onOpenChange={(open) => {
            console.log("[VersionTabs] GeneratePdfDialog onOpenChange called, open:", open);
            setPdfDialogOpen(open);
            if (!open) setPdfVersion(null);
          }}
          lessonId={lessonId}
          version={pdfVersion}
        />
      )}
    </>
  );
}
