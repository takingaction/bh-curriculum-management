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

function findTextMatchesInHTML(html: string, search: string, caseSensitive: boolean = true): { before: string; match: string; after: string; position: number }[] {
  if (!html || !search) return [];

  const matches: { before: string; match: string; after: string; position: number }[] = [];
  const searchStr = caseSensitive ? search : search.toLowerCase();

  const segments: { type: "text" | "tag"; content: string }[] = [];

  const allTagsRegex = /<[^>]+>/g;
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

  // Build flat text from all text segments concatenated together
  // to allow finding matches that span across inline tag boundaries
  const textSegments: { content: string; startPos: number }[] = [];
  let flatText = "";
  let flatPosition = 0;
  for (const seg of segments) {
    if (seg.type === "text") {
      textSegments.push({ content: seg.content, startPos: flatPosition });
      flatText += seg.content;
      flatPosition += seg.content.length;
    }
  }

  if (flatText.length === 0) return [];

  const flatToSearch = caseSensitive ? flatText : flatText.toLowerCase();
  let searchIdx = 0;

  while (searchIdx < flatToSearch.length) {
    const foundIdx = flatToSearch.indexOf(searchStr, searchIdx);
    if (foundIdx === -1) break;

    const matchEndIdx = foundIdx + search.length;

    // Check if match spans across segment boundaries
    let spanningSegments = false;
    for (let i = 0; i < textSegments.length - 1; i++) {
      const segEnd = textSegments[i].startPos + textSegments[i].content.length;
      if (foundIdx < segEnd && matchEndIdx > segEnd) {
        spanningSegments = true;
        break;
      }
    }

    if (spanningSegments) {
      // Handle cross-segment match: build before/match/after from multiple segments
      let before = "";
      let match = "";
      let after = "";

      for (let i = 0; i < textSegments.length; i++) {
        const segStart = textSegments[i].startPos;
        const segEnd = segStart + textSegments[i].content.length;
        const segContent = textSegments[i].content;

        if (matchEndIdx <= segStart) {
          // This segment is entirely after the match
          after += segContent;
        } else if (foundIdx >= segEnd) {
          // This segment is entirely before the match
          before += segContent;
        } else {
          // This segment overlaps with the match
          const localStart = Math.max(0, foundIdx - segStart);
          const localEnd = Math.min(segContent.length, matchEndIdx - segStart);

          // Before part (if any in this segment before the match)
          if (localStart > 0) {
            before += segContent.slice(0, localStart);
          }

          // Match part (if any in this segment)
          if (localStart < segContent.length && localEnd > 0) {
            match += segContent.slice(localStart, localEnd);
          }

          // After part (if any in this segment after the match)
          if (localEnd < segContent.length) {
            after += segContent.slice(localEnd);
          }

          // Add any subsequent segments to after
          for (let j = i + 1; j < textSegments.length; j++) {
            after += textSegments[j].content;
          }
          break;
        }
      }

      matches.push({
        before,
        match,
        after,
        position: foundIdx,
      });
    } else {
      // Match within a single segment
      let segIdx = 0;
      for (let i = 0; i < textSegments.length; i++) {
        const segStart = textSegments[i].startPos;
        const segEnd = segStart + textSegments[i].content.length;
        if (foundIdx >= segStart && foundIdx < segEnd) {
          segIdx = i;
          break;
        }
      }

      const segStart = textSegments[segIdx].startPos;
      const segContent = textSegments[segIdx].content;
      const localIdx = foundIdx - segStart;

      const before = segContent.slice(0, localIdx);
      const match = segContent.slice(localIdx, localIdx + search.length);
      const after = segContent.slice(localIdx + search.length);

      matches.push({
        before,
        match,
        after,
        position: foundIdx,
      });
    }

    searchIdx = foundIdx + 1;
  }

  return matches;
}

export function replaceTextInHTML(html: string, search: string, replace: string, caseSensitive: boolean = true): string {
  if (!html || !search) return html;

  const searchStr = caseSensitive ? search : search.toLowerCase();

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

  // Build flat text and segment info
  const textSegments: { content: string; startPos: number }[] = [];
  let flatText = "";
  let flatPosition = 0;
  for (const seg of segments) {
    if (seg.type === "text") {
      textSegments.push({ content: seg.content, startPos: flatPosition });
      flatText += seg.content;
      flatPosition += seg.content.length;
    }
  }

  if (flatText.length === 0) return html;

  const flatToSearch = caseSensitive ? flatText : flatText.toLowerCase();

  // Find all match positions in flat text
  const matchPositions: { start: number; end: number; segIdx: number; localStart: number }[] = [];
  let searchIdx = 0;
  while (searchIdx < flatToSearch.length) {
    const foundIdx = flatToSearch.indexOf(searchStr, searchIdx);
    if (foundIdx === -1) break;

    // Find which segment this match starts in
    for (let i = 0; i < textSegments.length; i++) {
      const segStart = textSegments[i].startPos;
      const segEnd = segStart + textSegments[i].content.length;
      if (foundIdx >= segStart && foundIdx < segEnd) {
        const localStart = foundIdx - segStart;
        const matchEnd = foundIdx + search.length;
        // Only include matches that stay within the same segment
        if (matchEnd <= segEnd) {
          matchPositions.push({ start: foundIdx, end: matchEnd, segIdx: i, localStart });
        }
        break;
      }
    }
    searchIdx = foundIdx + 1;
  }

  // Build result by reconstructing HTML with replacements
  const result: { type: "text" | "tag"; content: string }[] = [];
  let matchPosIdx = 0;

  for (const seg of segments) {
    if (seg.type === "tag") {
      result.push(seg);
    } else {
      let newText = "";
      let localIdx = 0;

      while (localIdx < seg.content.length) {
        // Check if there's a match starting at current position in this segment
        if (matchPosIdx < matchPositions.length &&
            matchPositions[matchPosIdx].segIdx === textSegments.findIndex(ts => ts.content === seg.content) &&
            matchPositions[matchPosIdx].localStart === localIdx) {
          // Apply replacement
          newText += replace;
          localIdx += search.length;
          matchPosIdx++;
        } else {
          // Check if we're inside a match (shouldn't happen with above logic, but safety check)
          let inMatch = false;
          const segIdx = textSegments.findIndex(ts => ts.content === seg.content);
          for (const mp of matchPositions) {
            if (mp.segIdx === segIdx &&
                localIdx >= mp.localStart &&
                localIdx < mp.localStart + search.length) {
              inMatch = true;
              break;
            }
          }
          if (inMatch) {
            localIdx++;
          } else {
            newText += seg.content[localIdx];
            localIdx++;
          }
        }
      }

      result.push({ type: "text", content: newText });
    }
  }

  return result.map(r => r.content).join("");
}

export function replaceTextPreserveCase(html: string, search: string, replace: string, caseSensitive: boolean = true): string {
  if (!html || !search) return html;

  const searchStr = caseSensitive ? search : search.toLowerCase();

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

  // Build flat text and segment info
  const textSegments: { content: string; startPos: number }[] = [];
  let flatText = "";
  let flatPosition = 0;
  for (const seg of segments) {
    if (seg.type === "text") {
      textSegments.push({ content: seg.content, startPos: flatPosition });
      flatText += seg.content;
      flatPosition += seg.content.length;
    }
  }

  if (flatText.length === 0) return html;

  const flatToSearch = caseSensitive ? flatText : flatText.toLowerCase();

  // Find all match positions in flat text
  const matchPositions: { start: number; end: number; segIdx: number; localStart: number }[] = [];
  let searchIdx = 0;
  while (searchIdx < flatToSearch.length) {
    const foundIdx = flatToSearch.indexOf(searchStr, searchIdx);
    if (foundIdx === -1) break;

    // Find which segment this match starts in
    for (let i = 0; i < textSegments.length; i++) {
      const segStart = textSegments[i].startPos;
      const segEnd = segStart + textSegments[i].content.length;
      if (foundIdx >= segStart && foundIdx < segEnd) {
        const localStart = foundIdx - segStart;
        const matchEnd = foundIdx + search.length;
        // Only include matches that stay within the same segment
        if (matchEnd <= segEnd) {
          matchPositions.push({ start: foundIdx, end: matchEnd, segIdx: i, localStart });
        }
        break;
      }
    }
    searchIdx = foundIdx + 1;
  }

  // Build result by reconstructing HTML with replacements
  const result: { type: "text" | "tag"; content: string }[] = [];
  let matchPosIdx = 0;

  for (const seg of segments) {
    if (seg.type === "tag") {
      result.push(seg);
    } else {
      let newText = "";
      let localIdx = 0;
      const segIdx = textSegments.findIndex(ts => ts.content === seg.content);

      while (localIdx < seg.content.length) {
        // Check if there's a match starting at current position in this segment
        if (matchPosIdx < matchPositions.length &&
            matchPositions[matchPosIdx].segIdx === segIdx &&
            matchPositions[matchPosIdx].localStart === localIdx) {
          // Apply replacement with case preserved
          const originalMatch = seg.content.slice(localIdx, localIdx + search.length);
          const replacementWithCase = applyCase(originalMatch, replace);
          newText += replacementWithCase;
          localIdx += search.length;
          matchPosIdx++;
        } else {
          // Check if we're inside a match
          let inMatch = false;
          for (const mp of matchPositions) {
            if (mp.segIdx === segIdx &&
                localIdx >= mp.localStart &&
                localIdx < mp.localStart + search.length) {
              inMatch = true;
              break;
            }
          }
          if (inMatch) {
            localIdx++;
          } else {
            newText += seg.content[localIdx];
            localIdx++;
          }
        }
      }

      result.push({ type: "text", content: newText });
    }
  }

  return result.map(r => r.content).join("");
}

function applyCase(original: string, replacement: string): string {
  if (!original) return replacement;

  const isAllUpper = original === original.toUpperCase();
  const isAllLower = original === original.toLowerCase();
  const isTitleCase = original[0] === original[0].toUpperCase() && original.slice(1) === original.slice(1).toLowerCase();

  if (isAllUpper) {
    return replacement.toUpperCase();
  } else if (isAllLower) {
    return replacement.toLowerCase();
  } else if (isTitleCase) {
    return replacement.charAt(0).toUpperCase() + replacement.slice(1).toLowerCase();
  } else {
    return replacement;
  }
}

export function findMatchesInContent(html: string, search: string, fieldName: string, caseSensitive: boolean = true): TextMatch | null {
  if (!html || !search) return null;

  const matches = findTextMatchesInHTML(html, search, caseSensitive);
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
