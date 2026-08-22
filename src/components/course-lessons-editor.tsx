"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { GripVertical, Pencil, X, Check, PlusIcon, ChevronUp, ChevronDown } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface Lesson {
  id: string;
  lesson_number: number;
  title: string;
  total_time: string | null;
  display_order: number;
}

interface Unit {
  id: string;
  title: string;
  display_order: number;
}

interface SortableItem {
  type: "lesson" | "unit";
  id: string;
  data: Lesson | Unit;
  displayOrder: number;
}

interface CourseLessonsEditorProps {
  courseId: string;
  initialLessons: Lesson[];
  initialUnits: Unit[];
}

function UnitCard({
  unit,
  onTitleChange,
  onDelete,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
}: {
  unit: Unit;
  onTitleChange: (id: string, newTitle: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onMoveUp?: (id: string) => void;
  onMoveDown?: (id: string) => void;
  isFirst?: boolean;
  isLast?: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(unit.title);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleSave = async () => {
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

  if (isEditing) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-gray-50 border-gray-300">
        <div className="w-6" />
        <input
          type="text"
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave();
            if (e.key === "Escape") {
              setEditTitle(unit.title);
              setIsEditing(false);
            }
          }}
          className="flex-1 px-2 py-1 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-[#0d7377]"
          autoFocus
        />
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="p-1 hover:bg-green-100 rounded text-green-600"
        >
          <Check className="w-4 h-4" />
        </button>
        <button
          onClick={() => {
            setEditTitle(unit.title);
            setIsEditing(false);
          }}
          className="p-1 hover:bg-gray-200 rounded text-gray-600"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-gray-100 border-gray-200 hover:bg-gray-50">
        <GripVertical className="w-4 h-4 cursor-grab text-gray-400" />
        <span className="flex-1 font-medium text-sm">{unit.title}</span>

        <div className="flex items-center gap-1">
          <button
            onClick={() => onMoveUp?.(unit.id)}
            disabled={isFirst}
            className={`p-1 rounded ${isFirst ? 'text-gray-300 cursor-not-allowed' : 'hover:bg-gray-200 text-gray-500'}`}
            title="Move up"
          >
            <ChevronUp className="w-4 h-4" />
          </button>
          <button
            onClick={() => onMoveDown?.(unit.id)}
            disabled={isLast}
            className={`p-1 rounded ${isLast ? 'text-gray-300 cursor-not-allowed' : 'hover:bg-gray-200 text-gray-500'}`}
            title="Move down"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>

        <button
          onClick={() => setIsEditing(true)}
          className="p-1 hover:bg-gray-200 rounded text-gray-400 hover:text-gray-600"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => setShowDeleteConfirm(true)}
          className="p-1 hover:bg-red-100 rounded text-gray-400 hover:text-red-600"
        >
          <X className="w-3.5 h-3.5" />
        </button>
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

function LessonItem({
  lesson,
  courseId,
}: {
  lesson: Lesson;
  courseId: string;
}) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg border border-gray-200">
      <div className="w-8 text-center font-medium text-gray-500">
        {lesson.lesson_number}
      </div>
      <span className="flex-1 text-sm">{lesson.title}</span>
      <span className="text-xs text-gray-400">{lesson.total_time || "-"}</span>
      <div className="flex gap-2">
        <Link href={`/lessons/${lesson.id}`}>
          <Button variant="outline" size="sm">
            View
          </Button>
        </Link>
        <Link href={`/admin/courses/${courseId}/lessons/${lesson.id}`}>
          <Button variant="outline" size="sm">
            Edit
          </Button>
        </Link>
      </div>
    </div>
  );
}

export function CourseLessonsEditor({ courseId, initialLessons, initialUnits }: CourseLessonsEditorProps) {
  const [lessons, setLessons] = useState<Lesson[]>(initialLessons);
  const [units, setUnits] = useState<Unit[]>(initialUnits);
  const [isLoading, setIsLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [lessonsRes, unitsRes] = await Promise.all([
        fetch(`/api/courses/${courseId}/lessons`),
        fetch(`/api/courses/${courseId}/units`),
      ]);
      const lessonsData = await lessonsRes.json();
      const unitsData = await unitsRes.json();
      if (lessonsData.lessons) setLessons(lessonsData.lessons);
      if (unitsData.units) setUnits(unitsData.units);
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setIsLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getItems = (): SortableItem[] => {
    const items: SortableItem[] = [];

    lessons.forEach((lesson) => {
      items.push({
        type: "lesson",
        id: lesson.id,
        data: lesson,
        displayOrder: lesson.display_order,
      });
    });

    units.forEach((unit) => {
      items.push({
        type: "unit",
        id: unit.id,
        data: unit,
        displayOrder: unit.display_order,
      });
    });

    return items.sort((a, b) => a.displayOrder - b.displayOrder);
  };

  const handleAddUnit = async () => {
    const title = `UNIT`;
    const allOrders = [
      0,
      ...lessons.map(l => l.display_order),
      ...units.map(u => u.display_order),
    ];
    const minOrder = Math.min(...allOrders);
    const newOrder = minOrder - 1;

    try {
      const res = await fetch(`/api/courses/${courseId}/units`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          displayOrder: newOrder,
        }),
      });
      const data = await res.json();
      if (data.unit) {
        setUnits([data.unit, ...units]);
      }
    } catch (error) {
      console.error("Failed to add unit:", error);
    }
  };

  const handleUnitTitleChange = async (unitId: string, newTitle: string) => {
    const currentUnit = units.find(u => u.id === unitId);
    const preservedOrder = currentUnit?.display_order;

    const res = await fetch(`/api/courses/${courseId}/units/${unitId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newTitle }),
    });
    const data = await res.json();
    if (data.unit) {
      setUnits(units.map((u) => u.id === unitId ? { ...data.unit, display_order: preservedOrder } : u));
    } else {
      throw new Error(data.error || "Failed to update unit");
    }
  };

  const handleUnitDelete = async (unitId: string) => {
    const res = await fetch(`/api/courses/${courseId}/units/${unitId}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setUnits(units.filter((u) => u.id !== unitId));
    } else {
      throw new Error("Failed to delete unit");
    }
  };

  const handleMoveUp = async (unitId: string) => {
    const items = getItems();
    const unitIndex = items.findIndex((i) => i.type === "unit" && i.id === unitId);
    if (unitIndex <= 0) return;

    const unit = items[unitIndex];
    const above = items[unitIndex - 1];

    // Move unit to just above the item before it
    const newUnitOrder = above.displayOrder - 0.5;

    setUnits(units.map((u) => u.id === unitId ? { ...u, display_order: newUnitOrder } : u));

    try {
      await fetch(`/api/courses/${courseId}/units/${unitId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayOrder: newUnitOrder }),
      });
    } catch (error) {
      console.error("Failed to reorder:", error);
      fetchData();
    }
  };

  const handleMoveDown = async (unitId: string) => {
    const items = getItems();
    const unitIndex = items.findIndex((i) => i.type === "unit" && i.id === unitId);
    if (unitIndex < 0 || unitIndex >= items.length - 1) return;

    const unit = items[unitIndex];
    const below = items[unitIndex + 1];

    // Move unit to just below the item after it
    const newUnitOrder = below.displayOrder + 0.5;

    setUnits(units.map((u) => u.id === unitId ? { ...u, display_order: newUnitOrder } : u));

    try {
      await fetch(`/api/courses/${courseId}/units/${unitId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayOrder: newUnitOrder }),
      });
    } catch (error) {
      console.error("Failed to reorder:", error);
      fetchData();
    }
  };

  const items = getItems();
  const unitItems = items.filter((i) => i.type === "unit");

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold text-gray-700">
          Lessons ({lessons.length}) & Units ({units.length})
        </h3>
        <Button size="sm" onClick={handleAddUnit}>
          <PlusIcon className="w-4 h-4 mr-1" />
          Add Unit
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <div className="animate-spin w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full" />
          Loading...
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item, index) => {
            if (item.type === "unit") {
              const unit = item.data as Unit;
              const unitIndexInItems = index;
              const prevItem = unitIndexInItems > 0 ? items[unitIndexInItems - 1] : null;
              const nextItem = unitIndexInItems < items.length - 1 ? items[unitIndexInItems + 1] : null;

              // A unit is "first" only if nothing above it (at absolute top)
              // A unit is "last" only if nothing below it (at absolute bottom)
              const isFirst = !prevItem;
              const isLast = !nextItem;

              return (
                <UnitCard
                  key={unit.id}
                  unit={unit}
                  onTitleChange={handleUnitTitleChange}
                  onDelete={handleUnitDelete}
                  onMoveUp={handleMoveUp}
                  onMoveDown={handleMoveDown}
                  isFirst={isFirst}
                  isLast={isLast}
                />
              );
            } else {
              const lesson = item.data as Lesson;
              return (
                <LessonItem
                  key={lesson.id}
                  lesson={lesson}
                  courseId={courseId}
                />
              );
            }
          })}
        </div>
      )}

      {items.length === 0 && <p className="text-gray-500 text-sm">No lessons yet</p>}

      <div>
        <Link href={`/admin/courses/${courseId}/lessons/new`}>
          <Button>Add Lesson</Button>
        </Link>
      </div>
    </div>
  );
}
