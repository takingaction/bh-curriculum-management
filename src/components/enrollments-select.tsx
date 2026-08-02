"use client";

import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

const DISCIPLINES = ["MUSIC", "THEATRE", "DANCE"] as const;
const GRADES = ["TK", "K", "1", "2", "3", "4", "5", "6"] as const;

interface EnrollmentsSelectProps {
  value: string[];
  onChange: (enrollments: string[]) => void;
}

export function EnrollmentsSelect({ value, onChange }: EnrollmentsSelectProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set(value));

  useEffect(() => {
    setSelected(new Set(value));
  }, [value]);

  const isAllSelected = selected.has("ALL");

  const isDisciplineFullySelected = (discipline: string) => {
    const grades = GRADES.map(g => `${discipline}_GRADE_${g}`);
    return grades.every(g => selected.has(g));
  };

  const toggleAll = () => {
    if (isAllSelected) {
      const newSelected = new Set<string>();
      onChange(Array.from(newSelected));
      setSelected(newSelected);
    } else {
      const newSelected = new Set<string>(["ALL"]);
      onChange(Array.from(newSelected));
      setSelected(newSelected);
    }
  };

  const toggleDiscipline = (discipline: string) => {
    const grades = GRADES.map(g => `${discipline}_GRADE_${g}`);
    const allSelected = isDisciplineFullySelected(discipline);

    const newSelected = new Set(selected);
    
    if (allSelected) {
      newSelected.delete(discipline);
      grades.forEach(g => newSelected.delete(g));
    } else {
      newSelected.add(discipline);
      grades.forEach(g => newSelected.add(g));
    }
    
    newSelected.delete("ALL");
    onChange(Array.from(newSelected));
    setSelected(newSelected);
  };

  const toggleGrade = (discipline: string, grade: string) => {
    const enrollment = `${discipline}_GRADE_${grade}`;
    const newSelected = new Set(selected);
    
    if (newSelected.has(enrollment)) {
      newSelected.delete(enrollment);
      newSelected.delete(discipline);
    } else {
      newSelected.add(enrollment);
      if (isDisciplineFullySelected(discipline)) {
        newSelected.add(discipline);
      }
    }
    
    newSelected.delete("ALL");
    onChange(Array.from(newSelected));
    setSelected(newSelected);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Button
          type="button"
          variant={isAllSelected ? "default" : "outline"}
          size="sm"
          onClick={toggleAll}
          className={isAllSelected ? "bg-[#0d7377] hover:bg-[#0a5c5f]" : "border-[#0d7377] text-[#0d7377]"}
        >
          ALL
        </Button>
        <span className="text-sm text-gray-500">Access to all materials</span>
      </div>

      <div className="border-t pt-4">
        <Label className="text-base font-semibold mb-3 block">By Discipline</Label>
        <div className="flex flex-wrap gap-2 mb-4">
          {DISCIPLINES.map(discipline => (
            <Button
              key={discipline}
              type="button"
              variant={selected.has(discipline) ? "default" : "outline"}
              size="sm"
              onClick={() => toggleDiscipline(discipline)}
              className={
                selected.has(discipline)
                  ? "bg-[#0d7377] hover:bg-[#0a5c5f]"
                  : "border-[#0d7377] text-[#0d7377]"
              }
            >
              {discipline}
            </Button>
          ))}
        </div>

        <div className="space-y-3">
          {DISCIPLINES.map(discipline => (
            <div key={discipline} className="border rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-medium w-20">{discipline}</span>
                <div className="flex flex-wrap gap-1">
                  {GRADES.map(grade => {
                    const enrollment = `${discipline}_GRADE_${grade}`;
                    return (
                      <Button
                        key={grade}
                        type="button"
                        variant={selected.has(enrollment) ? "default" : "outline"}
                        size="sm"
                        onClick={() => toggleGrade(discipline, grade)}
                        className={
                          selected.has(enrollment)
                            ? "bg-[#0d7377] hover:bg-[#0a5c5f] h-7 text-xs"
                            : "border-[#0d7377] text-[#0d7377] hover:bg-[#0d7377] hover:text-white h-7 text-xs"
                        }
                      >
                        {grade === "TK" ? "TK" : grade === "K" ? "K" : grade}
                      </Button>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t pt-4">
        <Label className="text-sm text-gray-500">Selected enrollments</Label>
        <div className="mt-1 text-sm text-gray-700">
          {selected.size === 0 ? (
            <span className="italic">None selected (teacher will have no course access)</span>
          ) : (
            Array.from(selected).sort().join(", ")
          )}
        </div>
      </div>
    </div>
  );
}
