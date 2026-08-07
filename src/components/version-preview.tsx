"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { LessonVersion } from "@/lib/version-utils";
import { parseVersionContentForDisplay, TEXT_FIELDS_LIST } from "@/lib/version-utils";
import { getFieldLabel } from "@/lib/html-utils";

interface VersionPreviewProps {
  version: LessonVersion;
}

export function VersionPreview({ version }: VersionPreviewProps) {
  const content = parseVersionContentForDisplay(version.content, TEXT_FIELDS_LIST);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(content.map((c) => c.fieldName))
  );

  const toggleSection = (fieldName: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(fieldName)) {
      newExpanded.delete(fieldName);
    } else {
      newExpanded.add(fieldName);
    }
    setExpandedSections(newExpanded);
  };

  if (content.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        This version has no content.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {content.map(({ fieldName, fieldLabel, html }) => {
        const isExpanded = expandedSections.has(fieldName);
        const hasContent = html && html.replace(/<[^>]*>/g, "").trim().length > 0;

        if (!hasContent) return null;

        return (
          <div key={fieldName} className="border border-gray-200 rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => toggleSection(fieldName)}
              className="w-full flex items-center gap-2 px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
            >
              {isExpanded ? (
                <ChevronDown className="w-4 h-4 flex-shrink-0 text-gray-500" />
              ) : (
                <ChevronRight className="w-4 h-4 flex-shrink-0 text-gray-500" />
              )}
              <span className="font-medium text-sm text-gray-800">{fieldLabel}</span>
            </button>

            {isExpanded && (
              <div className="p-3">
                <div
                  className="lesson-content text-sm text-gray-700"
                  dangerouslySetInnerHTML={{ __html: html }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
