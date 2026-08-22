"use client";

import { useState, useRef, useEffect } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Pencil, X, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface Unit {
  id: string;
  title: string;
  display_order: number;
}

interface UnitCardProps {
  unit: Unit;
  onTitleChange: (id: string, newTitle: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  isDragging?: boolean;
}

export function UnitCard({ unit, onTitleChange, onDelete, isDragging }: UnitCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(unit.title);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSave = async () => {
    if (editTitle.trim() === unit.title) {
      setIsEditing(false);
      return;
    }

    if (!editTitle.trim()) {
      alert("Title cannot be empty");
      return;
    }

    setIsSaving(true);
    try {
      await onTitleChange(unit.id, editTitle.trim());
      setIsEditing(false);
    } catch (error) {
      console.error("Failed to update unit:", error);
      setEditTitle(unit.title);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditTitle(unit.title);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape") {
      handleCancel();
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onDelete(unit.id);
      setShowDeleteConfirm(false);
    } catch (error) {
      console.error("Failed to delete unit:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <div
        className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all ${
          isDragging
            ? "bg-[#e37c64] border-[#e37c64] text-white shadow-lg"
            : "bg-gray-100 border-gray-200 hover:bg-gray-50"
        }`}
      >
        <div className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600">
          <GripVertical className="w-4 h-4" />
        </div>

        {isEditing ? (
          <div className="flex-1 flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1 px-2 py-1 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-[#0d7377]"
            />
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="p-1 hover:bg-green-100 rounded text-green-600 disabled:opacity-50"
              title="Save"
            >
              <Check className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleCancel}
              disabled={isSaving}
              className="p-1 hover:bg-gray-200 rounded text-gray-600 disabled:opacity-50"
              title="Cancel"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <>
            <span
              className="flex-1 font-medium text-sm cursor-pointer"
              onClick={() => setIsEditing(true)}
              title="Click to edit"
            >
              {unit.title}
            </span>
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="p-1 hover:bg-gray-200 rounded text-gray-400 hover:text-gray-600"
              title="Edit title"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="p-1 hover:bg-red-100 rounded text-gray-400 hover:text-red-600"
              title="Delete unit"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </>
        )}
      </div>

      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Unit</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">
            Are you sure you want to delete &quot;{unit.title}&quot;? This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

interface SortableUnitCardProps {
  unit: Unit;
  onTitleChange: (id: string, newTitle: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export function SortableUnitCard({ unit, onTitleChange, onDelete }: SortableUnitCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `unit-${unit.id}` });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : "auto",
  };

  return (
    <div ref={setNodeRef} style={style}>
      <UnitCard
        unit={unit}
        onTitleChange={onTitleChange}
        onDelete={onDelete}
        isDragging={isDragging}
      />
    </div>
  );
}
