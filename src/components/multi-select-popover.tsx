"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, X } from "lucide-react";

export interface MultiSelectOption {
  value: string;
  label: string;
}

interface MultiSelectPopoverProps {
  label: string;
  options: MultiSelectOption[];
  selected: string[];
  onChange: (next: string[]) => void;
  className?: string;
}

export function MultiSelectPopover({
  label,
  options,
  selected,
  onChange,
  className,
}: MultiSelectPopoverProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const toggle = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  const triggerLabel =
    selected.length === 0
      ? label
      : `${label}: ${options
          .filter((o) => selected.includes(o.value))
          .map((o) => o.label)
          .join(", ")}`;

  return (
    <div ref={containerRef} className={`relative ${className || ""}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="h-10 px-3 pr-8 border border-[#e5e5e0] rounded-md text-sm bg-white text-[#2d2d2d] focus:outline-none focus:ring-2 focus:ring-[#0d7377] flex items-center gap-1 min-w-[180px]"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="truncate">{triggerLabel}</span>
        <ChevronDown className="w-4 h-4 ml-auto text-gray-400 flex-shrink-0" />
      </button>

      {open && (
        <div
          className="absolute z-30 mt-1 right-0 w-56 bg-white border border-[#e5e5e0] rounded-md shadow-lg p-2"
          role="listbox"
        >
          <div className="flex items-center justify-between mb-1 px-1">
            <span className="text-xs text-gray-500">
              {selected.length} selected
            </span>
            {selected.length > 0 && (
              <button
                type="button"
                onClick={() => onChange([])}
                className="text-xs text-[#0d7377] hover:underline"
              >
                Clear
              </button>
            )}
          </div>
          <div className="space-y-1">
            {options.map((opt) => {
              const isChecked = selected.includes(opt.value);
              return (
                <label
                  key={opt.value}
                  className="flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-gray-50 rounded cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggle(opt.value)}
                    className="h-4 w-4 rounded border-gray-300 text-[#0d7377] focus:ring-[#0d7377]"
                  />
                  <span>{opt.label}</span>
                </label>
              );
            })}
          </div>
        </div>
      )}

      {selected.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {options
            .filter((o) => selected.includes(o.value))
            .map((o) => (
              <span
                key={o.value}
                className="inline-flex items-center gap-1 px-2 py-1 bg-[#d7ffef] text-[#0d7377] rounded text-xs font-medium"
              >
                {o.label}
                <button
                  type="button"
                  onClick={() => toggle(o.value)}
                  className="hover:text-[#0a5c5f]"
                  aria-label={`Remove ${o.label}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
        </div>
      )}
    </div>
  );
}
