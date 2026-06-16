export interface TextMatch {
  fieldName: string;
  fieldLabel: string;
  html: string;
  matches: {
    before: string;
    match: string;
    after: string;
    position: number;
  }[];
}

export interface LessonContent {
  lessonId: string;
  lessonNumber: number;
  lessonTitle: string;
  courseId: string;
  courseName: string;
  fields: {
    [key: string]: string;
  };
}

const FIELD_LABELS: Record<string, string> = {
  lesson_outline: "Lesson Outline",
  learning_objectives: "Learning Objectives",
  vocabulary: "Vocabulary",
  materials: "Materials",
  vapa_text_block: "VAPA Standards",
  ncas_text_block: "NCAS Standards",
  welcome_opening: "Welcome and Opening Check-In",
  actual_class_expectations: "Class Expectations and Procedures",
  warm_up: "Warm Up",
  lesson_hook: 'Lesson "Hook"',
  main_activity: "Main Activity",
  instrument_expectations: "Instrument Expectations",
  reflection: "Reflection",
  closing_ceremony: "Closing Ceremony",
  assessment: "Assessment",
};

export function getFieldLabel(fieldName: string): string {
  return FIELD_LABELS[fieldName] || fieldName;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findTextMatchesInHTML(html: string, search: string): { before: string; match: string; after: string; position: number }[] {
  if (!html || !search) return [];

  const matches: { before: string; match: string; after: string; position: number }[] = [];
  const searchLower = search;
  let pos = 0;
  let htmlPos = 0;

  const openTagRegex = /<[^>]+>/g;
  const closeTagRegex = /<\/[^>]+>/g;
  const allTagsRegex = /<[^>]+>/g;

  const segments: { type: "text" | "tag"; content: string; htmlStart: number; htmlEnd: number }[] = [];

  let lastIndex = 0;
  let tagMatch;

  allTagsRegex.lastIndex = 0;
  while ((tagMatch = allTagsRegex.exec(html)) !== null) {
    if (tagMatch.index > lastIndex) {
      segments.push({
        type: "text",
        content: html.slice(lastIndex, tagMatch.index),
        htmlStart: lastIndex,
        htmlEnd: tagMatch.index,
      });
    }
    segments.push({
      type: "tag",
      content: tagMatch[0],
      htmlStart: tagMatch.index,
      htmlEnd: tagMatch.index + tagMatch[0].length,
    });
    lastIndex = tagMatch.index + tagMatch[0].length;
  }

  if (lastIndex < html.length) {
    segments.push({
      type: "text",
      content: html.slice(lastIndex),
      htmlStart: lastIndex,
      htmlEnd: html.length,
    });
  }

  let textPosition = 0;
  for (const segment of segments) {
    if (segment.type === "text") {
      const text = segment.content;
      let searchIdx = 0;

      while (searchIdx < text.length) {
        const foundIdx = text.indexOf(searchLower, searchIdx);
        if (foundIdx === -1) break;

        const before = text.slice(0, foundIdx);
        const match = text.slice(foundIdx, foundIdx + search.length);
        const after = text.slice(foundIdx + search.length);

        matches.push({
          before,
          match,
          after,
          position: textPosition + foundIdx,
        });

        searchIdx = foundIdx + 1;
      }
      textPosition += text.length;
    } else {
    }
  }

  return matches;
}

export function replaceTextInHTML(html: string, search: string, replace: string): string {
  if (!html || !search) return html;

  const searchLower = search.toLowerCase();
  const replaceLen = replace.length;

  const allTagsRegex = /<[^>]+>/g;
  const segments: { type: "text" | "tag"; content: string }[] = [];

  let lastIndex = 0;
  let tagMatch;

  allTagsRegex.lastIndex = 0;
  while ((tagMatch = allTagsRegex.exec(html)) !== null) {
    if (tagMatch.index > lastIndex) {
      segments.push({
        type: "text",
        content: html.slice(lastIndex, tagMatch.index),
      });
    }
    segments.push({
      type: "tag",
      content: tagMatch[0],
    });
    lastIndex = tagMatch.index + tagMatch[0].length;
  }

  if (lastIndex < html.length) {
    segments.push({
      type: "text",
      content: html.slice(lastIndex),
    });
  }

  const result: { type: "text" | "tag"; content: string }[] = [];

  for (const segment of segments) {
    if (segment.type === "tag") {
      result.push(segment);
    } else {
      let text = segment.content;
      let searchIdx = 0;
      let newText = "";

      while (searchIdx < text.length) {
        const foundIdx = text.toLowerCase().indexOf(searchLower, searchIdx);
        if (foundIdx === -1) {
          newText += text.slice(searchIdx);
          break;
        }

        newText += text.slice(searchIdx, foundIdx);
        newText += replace;
        searchIdx = foundIdx + search.length;
      }

      result.push({
        type: "text",
        content: newText,
      });
    }
  }

  return result.map(r => r.content).join("");
}

export function findMatchesInContent(html: string, search: string, fieldName: string): TextMatch | null {
  if (!html || !search) return null;

  const matches = findTextMatchesInHTML(html, search);
  if (matches.length === 0) return null;

  return {
    fieldName,
    fieldLabel: getFieldLabel(fieldName),
    html,
    matches,
  };
}

export function generateSnippet(html: string, search: string, maxLength: number = 100): string {
  if (!html || !search) return "";

  const allTagsRegex = /<[^>]+>/g;
  const textOnly = html.replace(allTagsRegex, "");
  const searchLower = search.toLowerCase();
  const textLower = textOnly.toLowerCase();

  const matchIdx = textLower.indexOf(searchLower);
  if (matchIdx === -1) return textOnly.slice(0, maxLength) + "...";

  const start = Math.max(0, matchIdx - 40);
  const end = Math.min(textOnly.length, matchIdx + search.length + 60);

  let snippet = "";
  if (start > 0) snippet += "...";

  let textPos = 0;
  let inTag = false;
  let htmlIdx = 0;

  while (htmlIdx < html.length && textPos < end) {
    if (html[htmlIdx] === "<") {
      inTag = true;
      htmlIdx++;
      continue;
    }
    if (html[htmlIdx] === ">") {
      inTag = false;
      htmlIdx++;
      continue;
    }

    if (!inTag && textPos >= start) {
      snippet += html[htmlIdx];
    }
    if (!inTag) textPos++;
    htmlIdx++;
  }

  if (textPos < textOnly.length) snippet += "...";

  const searchLower2 = search.toLowerCase();
  const snippetLower = snippet.toLowerCase();
  const markIdx = snippetLower.indexOf(searchLower2);

  if (markIdx !== -1) {
    snippet = snippet.slice(0, markIdx) + "<mark>" + snippet.slice(markIdx, markIdx + search.length) + "</mark>" + snippet.slice(markIdx + search.length);
  }

  return snippet;
}

export async function findAndReplaceInLessons(
  lessons: any[],
  search: string,
  replace: string,
  db: any
): Promise<{ updatedCount: number; lessonsUpdated: number }> {
  let updatedCount = 0;
  const updatedLessonIds = new Set<string>();

  const TEXT_FIELDS = [
    "lesson_outline", "learning_objectives", "vocabulary", "materials",
    "vapa_text_block", "ncas_text_block", "welcome_opening",
    "actual_class_expectations", "warm_up", "lesson_hook",
    "main_activity", "instrument_expectations", "reflection",
    "closing_ceremony", "assessment"
  ];

  for (const lesson of lessons) {
    let lessonUpdated = false;

    const updates: Record<string, string> = {};

    for (const field of TEXT_FIELDS) {
      if (lesson[field] && typeof lesson[field] === "string") {
        const newContent = replaceTextInHTML(lesson[field], search, replace);
        if (newContent !== lesson[field]) {
          updates[field] = newContent;
          updatedCount += countMatchesInHTML(lesson[field], search);
          lessonUpdated = true;
        }
      }
    }

    if (lessonUpdated) {
      const { error } = await db
        .from("lessons")
        .update(updates)
        .eq("id", lesson.id);

      if (!error) {
        updatedLessonIds.add(lesson.id);
      }
    }
  }

  return {
    updatedCount,
    lessonsUpdated: updatedLessonIds.size,
  };
}

function countMatchesInHTML(html: string, search: string): number {
  if (!html || !search) return 0;
  const searchLower = search.toLowerCase();
  const allTagsRegex = /<[^>]+>/g;
  const textOnly = html.replace(allTagsRegex, "").toLowerCase();

  let count = 0;
  let pos = 0;
  while ((pos = textOnly.indexOf(searchLower, pos)) !== -1) {
    count++;
    pos += search.length;
  }
  return count;
}

export const TEXT_FIELDS_LIST = [
  "lesson_outline",
  "learning_objectives",
  "vocabulary",
  "materials",
  "vapa_text_block",
  "ncas_text_block",
  "welcome_opening",
  "actual_class_expectations",
  "warm_up",
  "lesson_hook",
  "main_activity",
  "instrument_expectations",
  "reflection",
  "closing_ceremony",
  "assessment",
];
