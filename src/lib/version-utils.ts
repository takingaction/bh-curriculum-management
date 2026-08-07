import { TEXT_FIELDS_LIST as _TEXT_FIELDS_LIST, getFieldLabel } from "./html-utils";

export const TEXT_FIELDS_LIST = _TEXT_FIELDS_LIST;

export const MODIFICATION_REASONS = ["duration", "special_needs", "materials", "venue"] as const;
export type ModificationReason = typeof MODIFICATION_REASONS[number];

export interface VersionContentField {
  html: string;
  original_length: number;
}

export interface VersionContent {
  [fieldName: string]: VersionContentField;
}

export interface LessonVersion {
  id: string;
  lesson_id: string;
  version_number: number;
  version_name: string;
  content: VersionContent;
  modification_reason: ModificationReason | null;
  created_by: string;
  is_approved: boolean;
  pdf_storage_path: string | null;
  pdf_generated_at: string | null;
  deleted_at: string | null;
  created_at: string;
}

export const REASON_LABELS: Record<ModificationReason, string> = {
  duration: "Duration",
  special_needs: "Special Needs",
  materials: "Materials",
  venue: "Venue",
};

export function stripHtml(html: string): string {
  if (!html) return "";
  return html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();
}

export function getFieldTextLength(html: string): number {
  return stripHtml(html).length;
}

export function validateContentLengths(
  originalContent: VersionContent,
  modifiedContent: VersionContent,
  fields: string[] = TEXT_FIELDS_LIST
): { valid: boolean; violations: { field: string; original: number; modified: number }[] } {
  const violations: { field: string; original: number; modified: number }[] = [];

  for (const field of fields) {
    const orig = originalContent[field]?.original_length || 0;
    const mod = modifiedContent[field];

    if (mod && typeof mod === "object" && "html" in mod) {
      const modLength = getFieldTextLength((mod as VersionContentField).html);
      if (modLength > orig) {
        violations.push({
          field,
          original: orig,
          modified: modLength,
        });
      }
    }
  }

  return {
    valid: violations.length === 0,
    violations,
  };
}

export function buildVersionContent(
  fields: Record<string, string>,
  modificationReason: ModificationReason | null
): VersionContent {
  const content: VersionContent = {};

  for (const fieldName of TEXT_FIELDS_LIST) {
    const html = fields[fieldName] || "";
    content[fieldName] = {
      html,
      original_length: getFieldTextLength(html),
    };
  }

  return content;
}

export function getVersionDisplayName(version: LessonVersion): string {
  if (!version.version_name || version.version_name === "Untitled Version") {
    return `Version ${version.version_number}`;
  }
  return version.version_name;
}

export function getWeekStart(date: Date = new Date()): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function formatWeekStart(date: Date): string {
  return date.toISOString().split("T")[0];
}

export function getPdfFileName(
  lessonNumber: number,
  grade: string,
  discipline: string,
  versionNumber: number,
  versionName: string
): string {
  const sanitizedName = versionName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const baseName = `${grade}-${discipline}-L${lessonNumber}`;
  if (sanitizedName) {
    return `v${versionNumber}-${sanitizedName}.pdf`;
  }
  return `v${versionNumber}.pdf`;
}

export function parseVersionContentForDisplay(
  content: VersionContent,
  fields: string[] = TEXT_FIELDS_LIST
): { fieldName: string; fieldLabel: string; html: string; originalLength: number }[] {
  return fields
    .filter((f) => content[f]?.html)
    .map((fieldName) => ({
      fieldName,
      fieldLabel: getFieldLabel(fieldName),
      html: content[fieldName].html,
      originalLength: content[fieldName].original_length,
    }));
}
