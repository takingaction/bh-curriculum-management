import { TEXT_FIELDS_LIST as _TEXT_FIELDS_LIST, getFieldLabel } from "./html-utils";

export const TEXT_FIELDS_LIST = _TEXT_FIELDS_LIST;

export const MODIFICATION_REASONS = ["duration", "translation"] as const;
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
  translation: "Translation",
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

const CAMEL_TO_SNAKE_MAP: Record<string, string> = {
  lessonOutline: 'lesson_outline',
  outline: 'lesson_outline',
  learningObjectives: 'learning_objectives',
  objectives: 'learning_objectives',
  vocabulary: 'vocabulary',
  vocab: 'vocabulary',
  materials: 'materials',
  vapaTextBlock: 'vapa_text_block',
  vapa: 'vapa_text_block',
  vapaStandards: 'vapa_text_block',
  ncasTextBlock: 'ncas_text_block',
  ncas: 'ncas_text_block',
  ncasStandards: 'ncas_text_block',
  welcomeAndOpeningCheckIn: 'welcome_opening',
  welcomeOpeningCheckIn: 'welcome_opening',
  welcomeOpening: 'welcome_opening',
  opening: 'welcome_opening',
  classExpectationsAndProcedures: 'actual_class_expectations',
  classExpectationsProcedures: 'actual_class_expectations',
  classExpectations: 'actual_class_expectations',
  expectations: 'actual_class_expectations',
  warmUp: 'warm_up',
  warmup: 'warm_up',
  lessonHook: 'lesson_hook',
  hook: 'lesson_hook',
  mainActivity: 'main_activity',
  mainActivity: 'main_activity',
  activity: 'main_activity',
  instrumentExpectations: 'instrument_expectations',
  instruments: 'instrument_expectations',
  reflection: 'reflection',
  closingCeremony: 'closing_ceremony',
  closing: 'closing_ceremony',
  assessment: 'assessment',
};

export function convertModifiedFields(
  modifiedFields: Record<string, { html?: string }>,
  originalFields?: Record<string, string>
): Record<string, { html: string }> {
  const result: Record<string, { html: string }> = {};

  for (const field of TEXT_FIELDS_LIST) {
    result[field] = { html: "" };
  }

  for (const [key, value] of Object.entries(modifiedFields)) {
    const snakeKey = CAMEL_TO_SNAKE_MAP[key] || key;
    if (result[snakeKey] && value?.html) {
      result[snakeKey] = { html: value.html };
    }
  }

  return result;
}
