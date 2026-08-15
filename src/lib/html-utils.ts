import { Parser } from "htmlparser2";
import { DomHandler, Text } from "domhandler";

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

function collectTextNodes(html: string): { data: string; startIndex: number; endIndex: number }[] {
  const textNodes: { data: string; startIndex: number; endIndex: number }[] = [];

  const handler = new DomHandler(undefined, { withStartIndices: true, withEndIndices: true });
  const parser = new Parser(handler);
  parser.parseComplete(html);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const walk = (nodes: any[]) => {
    for (const node of nodes) {
      if (node instanceof Text) {
        if (node.startIndex !== null && node.endIndex !== null && node.data) {
          textNodes.push({
            data: node.data,
            startIndex: node.startIndex,
            endIndex: node.endIndex,
          });
        }
      }
      if ('children' in node && node.children) {
        walk(node.children);
      }
    }
  };

  walk(handler.root.children);
  return textNodes;
}

function buildCharMap(textNodes: { data: string; startIndex: number; endIndex: number }[]) {
  const charMap: { nodeIdx: number; offsetInNode: number; htmlIndex: number }[] = [];

  for (let i = 0; i < textNodes.length; i++) {
    const tn = textNodes[i];
    for (let j = 0; j < tn.data.length; j++) {
      charMap.push({
        nodeIdx: i,
        offsetInNode: j,
        htmlIndex: tn.startIndex + j,
      });
    }
  }

  return charMap;
}

export function replaceTextInHTML(
  html: string,
  search: string,
  replace: string,
  caseSensitive: boolean = true
): string {
  if (!html || !search) return html;

  try {
    const textNodes = collectTextNodes(html);
    if (textNodes.length === 0) return html;

    const charMap = buildCharMap(textNodes);
    if (charMap.length === 0) return html;

    const fullText = textNodes.map(tn => tn.data).join('');
    const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const searchRegex = new RegExp(escapedSearch, caseSensitive ? 'g' : 'gi');

    type MatchSegment = { nodeIdx: number; flatStart: number; flatEnd: number; htmlPosStart: number; htmlPosEnd: number };
    type Match = { segments: MatchSegment[]; crossSegment: boolean };

    const matches: Match[] = [];
    let m: RegExpExecArray | null;

    while ((m = searchRegex.exec(fullText)) !== null) {
      const flatStart = m.index;
      const flatEnd = m.index + m[0].length - 1;

      const segments: MatchSegment[] = [];
      let currentNodeIdx = -1;
      let segmentFlatStart = -1;
      let segmentHtmlStart = -1;

      for (let flatPos = flatStart; flatPos <= flatEnd; flatPos++) {
        const entry = charMap[flatPos];
        if (flatPos === flatStart || entry.nodeIdx === currentNodeIdx) {
          if (entry.nodeIdx !== currentNodeIdx) {
            currentNodeIdx = entry.nodeIdx;
            segmentFlatStart = flatPos;
            segmentHtmlStart = entry.htmlIndex;
          }
        } else {
          segments.push({
            nodeIdx: currentNodeIdx,
            flatStart: segmentFlatStart,
            flatEnd: flatPos - 1,
            htmlPosStart: segmentHtmlStart,
            htmlPosEnd: charMap[flatPos - 1].htmlIndex,
          });
          currentNodeIdx = entry.nodeIdx;
          segmentFlatStart = flatPos;
          segmentHtmlStart = entry.htmlIndex;
        }
      }

      if (segmentFlatStart !== -1) {
        segments.push({
          nodeIdx: currentNodeIdx,
          flatStart: segmentFlatStart,
          flatEnd: flatEnd,
          htmlPosStart: segmentHtmlStart,
          htmlPosEnd: charMap[flatEnd].htmlIndex,
        });
      }

      matches.push({
        segments,
        crossSegment: segments.length > 1,
      });
    }

    if (matches.length === 0) return html;

    let result = html;

    for (const match of matches.reverse()) {
      if (match.crossSegment) {
        const numSegments = match.segments.length;
        const replaceLength = replace.length;
        const basePortion = Math.floor(replaceLength / numSegments);
        const remainder = replaceLength % numSegments;

        for (let i = numSegments - 1; i >= 0; i--) {
          const seg = match.segments[i];
          const segPortion = i === numSegments - 1
            ? basePortion + remainder
            : basePortion;
          const replaceStart = i * basePortion + Math.min(i, remainder);
          const replaceEnd = replaceStart + segPortion;
          const segReplacement = replace.slice(replaceStart, replaceEnd);

          result = result.slice(0, seg.htmlPosStart) + segReplacement + result.slice(seg.htmlPosEnd + 1);
        }
      } else {
        const seg = match.segments[0];
        result = result.slice(0, seg.htmlPosStart) + replace + result.slice(seg.htmlPosEnd + 1);
      }
    }

    return result;
  } catch (error) {
    console.error('replaceTextInHTML error:', error);
    return html;
  }
}

export function replaceTextPreserveCase(
  html: string,
  search: string,
  replace: string,
  caseSensitive: boolean = true
): string {
  if (!html || !search) return html;

  try {
    const textNodes = collectTextNodes(html);
    if (textNodes.length === 0) return html;

    const charMap = buildCharMap(textNodes);
    if (charMap.length === 0) return html;

    const fullText = textNodes.map(tn => tn.data).join('');
    const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const searchRegex = new RegExp(escapedSearch, caseSensitive ? 'g' : 'gi');

    type MatchSegment = { nodeIdx: number; flatStart: number; flatEnd: number; htmlPosStart: number; htmlPosEnd: number };
    type Match = { segments: MatchSegment[]; crossSegment: boolean; originalText: string };

    const matches: Match[] = [];
    let m: RegExpExecArray | null;

    while ((m = searchRegex.exec(fullText)) !== null) {
      const flatStart = m.index;
      const flatEnd = m.index + m[0].length - 1;

      const segments: MatchSegment[] = [];
      let currentNodeIdx = -1;
      let segmentFlatStart = -1;
      let segmentHtmlStart = -1;

      for (let flatPos = flatStart; flatPos <= flatEnd; flatPos++) {
        const entry = charMap[flatPos];
        if (flatPos === flatStart || entry.nodeIdx === currentNodeIdx) {
          if (entry.nodeIdx !== currentNodeIdx) {
            currentNodeIdx = entry.nodeIdx;
            segmentFlatStart = flatPos;
            segmentHtmlStart = entry.htmlIndex;
          }
        } else {
          segments.push({
            nodeIdx: currentNodeIdx,
            flatStart: segmentFlatStart,
            flatEnd: flatPos - 1,
            htmlPosStart: segmentHtmlStart,
            htmlPosEnd: charMap[flatPos - 1].htmlIndex,
          });
          currentNodeIdx = entry.nodeIdx;
          segmentFlatStart = flatPos;
          segmentHtmlStart = entry.htmlIndex;
        }
      }

      if (segmentFlatStart !== -1) {
        segments.push({
          nodeIdx: currentNodeIdx,
          flatStart: segmentFlatStart,
          flatEnd: flatEnd,
          htmlPosStart: segmentHtmlStart,
          htmlPosEnd: charMap[flatEnd].htmlIndex,
        });
      }

      matches.push({
        segments,
        crossSegment: segments.length > 1,
        originalText: m[0],
      });
    }

    if (matches.length === 0) return html;

    let result = html;
    for (const match of matches.reverse()) {
      if (match.crossSegment) {
        const numSegments = match.segments.length;
        const replaceLength = replace.length;
        const basePortion = Math.floor(replaceLength / numSegments);
        const remainder = replaceLength % numSegments;

        const origLength = match.originalText.length;
        const origBasePortion = Math.floor(origLength / numSegments);
        const origRemainder = origLength % numSegments;

        for (let i = numSegments - 1; i >= 0; i--) {
          const seg = match.segments[i];
          const segPortion = i === numSegments - 1
            ? basePortion + remainder
            : basePortion;
          const replaceStart = i * basePortion + Math.min(i, remainder);
          const replaceEnd = replaceStart + segPortion;
          const segReplacementRaw = replace.slice(replaceStart, replaceEnd);

          const origSegPortion = i === numSegments - 1
            ? origBasePortion + origRemainder
            : origBasePortion;
          const origStart = i * origBasePortion + Math.min(i, origRemainder);
          const origEnd = origStart + origSegPortion;
          const origPortion = match.originalText.slice(origStart, origEnd);

          const segReplacement = applyCase(origPortion, segReplacementRaw);

          result = result.slice(0, seg.htmlPosStart) + segReplacement + result.slice(seg.htmlPosEnd + 1);
        }
      } else {
        const seg = match.segments[0];
        const replacementWithCase = applyCase(match.originalText, replace);
        result = result.slice(0, seg.htmlPosStart) + replacementWithCase + result.slice(seg.htmlPosEnd + 1);
      }
    }

    return result;
  } catch (error) {
    console.error('replaceTextPreserveCase error:', error);
    return html;
  }
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

export function htmlToPlainText(html: string): string {
  if (!html) return "";

  const handler = new DomHandler(undefined, { withStartIndices: true, withEndIndices: true });
  const parser = new Parser(handler);
  parser.parseComplete(html);

  const BLOCK_TAGS = new Set(["p", "div", "h1", "h2", "h3", "h4", "h5", "h6", "li", "tr", "table", "ul", "ol", "br", "hr"]);
  const INLINE_TAGS = new Set(["strong", "b", "em", "i", "a", "img", "span", "td", "th"]);

  let result = "";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const walk = (nodes: any[], inBlockContext: boolean = false) => {
    for (let i = 0; i < nodes.length; i++) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const node: any = nodes[i];
      const isLastNode = i === nodes.length - 1;

      if (node instanceof Text) {
        result += node.data || "";
      } else if (node.name) {
        const tagName = node.name.toLowerCase();

        if (tagName === "br") {
          result += "\n";
        } else if (tagName === "p" || tagName === "div") {
          if (!inBlockContext) {
            result += "\n\n";
          }
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          walk(node.children || [], true);
          if (!isLastNode && !inBlockContext) {
            result += "\n\n";
          }
        } else if (/^h[1-6]$/.test(tagName)) {
          if (!inBlockContext && result.length > 0 && !result.endsWith("\n\n")) {
            result += "\n\n";
          }
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          walk(node.children || []);
          if (!isLastNode) {
            result += "\n\n";
          }
        } else if (tagName === "strong" || tagName === "b") {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const textContent = getTextContent(node.children || []);
          if (textContent) {
            result += "**" + textContent + "**";
          }
        } else if (tagName === "em" || tagName === "i") {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const textContent = getTextContent(node.children || []);
          if (textContent) {
            result += "*" + textContent + "*";
          }
        } else if (tagName === "a") {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          walk(node.children || []);
        } else if (tagName === "img") {
          result += "[image]";
        } else if (tagName === "li") {
          result += "- ";
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          walk(node.children || []);
          result += "\n";
        } else if (tagName === "td" || tagName === "th") {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          walk(node.children || []);
          if (!isLastNode) {
            result += " | ";
          }
        } else if (tagName === "tr") {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          walk(node.children || []);
          result += "\n";
        } else if (tagName === "ul" || tagName === "ol") {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          walk(node.children || []);
          if (!isLastNode) {
            result += "\n";
          }
        } else if (tagName === "table") {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          walk(node.children || []);
          if (!isLastNode) {
            result += "\n\n";
          }
        } else if (tagName === "hr") {
          result += "\n---\n";
        } else if (INLINE_TAGS.has(tagName)) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          walk(node.children || []);
        } else {
          // For unknown tags (including span), just walk children
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          walk(node.children || [], inBlockContext);
        }
      }
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  walk(handler.root.children);

  // Collapse multiple newlines to max 2
  result = result.replace(/\n{3,}/g, "\n\n");

  // Remove trailing newlines from each line and clean up spacing
  const lines = result.split("\n");
  const cleanedLines = lines.map(line => line.trim()).filter(line => line !== "" || lines.length === 1);

  return cleanedLines.join("\n").trim();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getTextContent(nodes: any[]): string {
  let text = "";
  for (const node of nodes) {
    if (node instanceof Text) {
      text += node.data || "";
    } else if (node.children) {
      text += getTextContent(node.children);
    }
  }
  return text;
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
