"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { SortableUnitCard } from "@/components/unit-card";
import { PlusIcon } from "lucide-react";

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

type SortableItem = {
  type: "lesson" | "unit";
  id: string;
  data: Lesson | Unit;
  displayOrder: number;
};

interface CourseLessonsEditorProps {
  courseId: string;
  initialLessons: Lesson[];
  initialUnits: Unit[];
}

export function CourseLessonsEditor({ courseId, initialLessons, initialUnits }: CourseLessonsEditorProps) {
  const [lessons, setLessons] = useState<Lesson[]>(initialLessons);
  const [units, setUnits] = useState<Unit[]>(initialUnits);
  const [isLoading, setIsLoading] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeItem, setActiveItem] = useState<SortableItem | null>(null);

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

  const getSortableItems = (): SortableItem[] => {
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
    const unitNumber = units.length + 1;
    const title = `UNIT [${unitNumber}]: `;

    try {
      const res = await fetch(`/api/courses/${courseId}/units`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          displayOrder: lessons.length > 0 ? Math.max(...lessons.map((l) => l.display_order)) + 1 : 1,
        }),
      });
      const data = await res.json();
      if (data.unit) {
        setUnits([...units, data.unit]);
      }
    } catch (error) {
      console.error("Failed to add unit:", error);
    }
  };

  const handleUnitTitleChange = async (unitId: string, newTitle: string) => {
    const res = await fetch(`/api/courses/${courseId}/units/${unitId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newTitle }),
    });
    const data = await res.json();
    if (data.unit) {
      setUnits(units.map((u) => (u.id === unitId ? data.unit : u)));
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

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    setActiveId(active.id as string);
    const items = getSortableItems();
    const item = items.find((i) => i.id === active.id);
    setActiveItem(item || null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setActiveItem(null);

    if (!over || active.id === over.id) return;

    const items = getSortableItems();
    const oldIndex = items.findIndex((i) => i.id === active.id);
    const newIndex = items.findIndex((i) => i.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    const reorderedItems = [...items];
    const [movedItem] = reorderedItems.splice(oldIndex, 1);
    reorderedItems.splice(newIndex, 0, movedItem);

    const updatedItems = reorderedItems.map((item, index) => ({
      ...item,
      displayOrder: index + 1,
    }));

    if (movedItem.type === "lesson") {
      setLessons((prev) =>
        prev.map((l) => {
          const updated = updatedItems.find((i) => i.id === l.id);
          return updated ? { ...l, display_order: updated.displayOrder } : l;
        })
      );
    } else {
      setUnits((prev) =>
        prev.map((u) => {
          const updated = updatedItems.find((i) => i.id === u.id);
          return updated ? { ...u, display_order: updated.displayOrder } : u;
        })
      );
    }

    try {
      const payload = updatedItems.map((item) => ({
        type: item.type,
        id: item.id,
        displayOrder: item.displayOrder,
      }));

      await fetch(`/api/courses/${courseId}/units/reorder`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: payload }),
      });
    } catch (error) {
      console.error("Failed to reorder:", error);
      fetchData();
    }
  };

  const sortableItems = getSortableItems();
  const activeType = activeItem?.type;
  const activeData = activeItem?.data;

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
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={sortableItems.map((i) => i.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {sortableItems.map((item) => {
                if (item.type === "unit") {
                  return (
                    <SortableUnitCard
                      key={item.id}
                      unit={item.data as Unit}
                      onTitleChange={handleUnitTitleChange}
                      onDelete={handleUnitDelete}
                    />
                  );
                } else {
                  const lesson = item.data as Lesson;
                  return (
                    <div
                      key={lesson.id}
                      className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg border border-gray-200 hover:bg-gray-50"
                    >
                      <span className="w-8 text-center font-medium text-gray-500">
                        {lesson.lesson_number}
                      </span>
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
              })}
            </div>
          </SortableContext>

          <DragOverlay>
            {activeId && activeType === "unit" && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-[#e37c64] border-[#e37c64] text-white shadow-lg">
                <span className="font-medium text-sm">{(activeData as Unit).title}</span>
              </div>
            )}
            {activeId && activeType === "lesson" && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-white border-gray-300 shadow-lg">
                <span className="w-8 text-center font-medium text-gray-500">
                  {(activeData as Lesson).lesson_number}
                </span>
                <span className="text-sm">{(activeData as Lesson).title}</span>
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}

      {sortableItems.length === 0 && (
        <p className="text-gray-500 text-sm">No lessons yet</p>
      )}

      <div>
        <Link href={`/admin/courses/${courseId}/lessons/new`}>
          <Button>Add Lesson</Button>
        </Link>
      </div>
    </div>
  );
}
