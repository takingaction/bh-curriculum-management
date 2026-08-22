import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { streamAnthropicResponse } from "@/lib/anthropic-stream";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-haiku-4-5";
const MODIFICATION_MODEL = "claude-opus-4-5";
const MAX_TOKENS = 32000;

// Field name alias mapping - maps alternate field names to canonical database names
const FIELD_ALIAS_MAP: Record<string, string> = {
  // Canonical names (map to themselves)
  'lesson_outline': 'lesson_outline',
  'learning_objectives': 'learning_objectives',
  'vocabulary': 'vocabulary',
  'materials': 'materials',
  'welcome_opening': 'welcome_opening',
  'actual_class_expectations': 'actual_class_expectations',
  'warm_up': 'warm_up',
  'lesson_hook': 'lesson_hook',
  'main_activity': 'main_activity',
  'instrument_expectations': 'instrument_expectations',
  'reflection': 'reflection',
  'closing_ceremony': 'closing_ceremony',
  'assessment': 'assessment',
  'vapa_text_block': 'vapa_text_block',
  'ncas_text_block': 'ncas_text_block',
  // Aliases
  'outline': 'lesson_outline',
  'objectives': 'learning_objectives',
  'vocab': 'vocabulary',
  'opening': 'welcome_opening',
  'welcome': 'welcome_opening',
  'welcome_and_opening': 'welcome_opening',
  'expectations': 'actual_class_expectations',
  'actual_class_and_expectations': 'actual_class_expectations',
  'warmup': 'warm_up',
  'hook': 'lesson_hook',
  'activity': 'main_activity',
  'instrument': 'instrument_expectations',
  'closing': 'closing_ceremony',
  'vapa_standards': 'vapa_text_block',
  'vapa': 'vapa_text_block',
  'ncas_standards': 'ncas_text_block',
  'ncas': 'ncas_text_block',
};

// Normalize a field name: apply alias mapping, then convert camelCase to snake_case
function normalizeFieldName(fieldName: string): string {
  // First check alias map
  const aliased = FIELD_ALIAS_MAP[fieldName];
  if (aliased) return aliased;
  // Then convert camelCase to snake_case
  const snake = fieldName.replace(/([A-Z])/g, '_$1').toLowerCase();
  return snake.startsWith('_') ? snake.substring(1) : snake;
}

type ModificationType = "duration" | "translation" | "materials";

interface ModificationDetection {
  isModification: boolean;
  type: ModificationType | null;
  direction: "shorter" | "longer" | null;
  targetFields: string[] | null;
  targetLanguage: string | null;
}

const MODIFICATION_PATTERNS: Record<ModificationType, string[]> = {
  materials: [
    "materials", "add material", "remove material", "change material", "different materials"
  ],
  duration: [
    "shorter", "longer", "reduce", "expand", "condense", "more time",
    "less time", "cut down", "scale down", "scale up", "brief", "concise",
    "not enough time", "too long", "too short", "time constraint",
    "minute version", "min version", "hour version"
  ],
  translation: [
    "translate", "translation",
    // Spanish
    "spanish version", "in spanish", "en español", "create a spanish", "make it spanish",
    // French
    "french version", "in french", "create a french", "make it french",
    // German
    "german version", "in german",
    // Portuguese
    "portuguese version", "in portuguese", "brazilian",
    // Chinese
    "chinese version", "in chinese", "mandarin",
    // Japanese
    "japanese version", "in japanese",
    // Korean
    "korean version", "in korean",
    // Russian
    "russian version", "in russian",
    // Arabic
    "arabic version", "in arabic",
    // Hindi
    "hindi version", "in hindi",
    // Italian
    "italian version", "in italian",
    // Dutch
    "dutch version", "in dutch",
    // Polish
    "polish version", "in polish",
    // Vietnamese
    "vietnamese version", "in vietnamese",
    // Greek
    "greek version", "in greek",
    // Hebrew
    "hebrew version", "in hebrew",
    // Thai
    "thai version", "in thai",
    // Urdu
    "urdu version", "in urdu",
    // Swahili
    "swahili version", "in swahili",
    // Tagalog
    "tagalog version", "in tagalog",
    // Creole
    "creole version", "in creole", "haitian creole",
    // Other
    "bilingual", "dual language", "english translation"
  ]
};

function parseDuration(durationStr: string | null): number | null {
  if (!durationStr) return null;

  const lower = durationStr.toLowerCase().trim();

  const minuteMatch = lower.match(/(\d+(?:\.\d+)?)\s*(?:min|minute)/);
  if (minuteMatch) {
    return parseFloat(minuteMatch[1]);
  }

  const hourMatch = lower.match(/(\d+(?:\.\d+)?)\s*(?:hr|hour|hr\.)/);
  if (hourMatch) {
    return parseFloat(hourMatch[1]) * 60;
  }

  const justNumber = lower.match(/^(\d+(?:\.\d+)?)$/);
  if (justNumber) {
    return parseFloat(justNumber[1]);
  }

  return null;
}

function extractTargetDuration(message: string): number | null {
  const lower = message.toLowerCase();

  const minuteMatch = lower.match(/(\d+(?:\.\d+)?)\s*(?:min|minute|min\.|minute\-|min-)/);
  if (minuteMatch) {
    return parseFloat(minuteMatch[1]);
  }

  const hourMatch = lower.match(/(\d+(?:\.\d+)?)\s*(?:hour|hr|hr\.)/);
  if (hourMatch) {
    return parseFloat(hourMatch[1]) * 60;
  }

  const versionMatch = lower.match(/(?:make it |create a |to |for )?(\d+)\s*(?:min|minute)?\s*(?:version|please)?$/);
  if (versionMatch) {
    return parseFloat(versionMatch[1]);
  }

  return null;
}

const DIRECTION_PATTERNS = {
  shorter: ["shorter", "reduce", "cut down", "condense", "brief", "scale down", "less", "not enough time", "too long", "instead of", "decrease", "min version", "cut to"],
  longer: ["longer", "expand", "more time", "scale up", "more", "too short", "add more", "increase", "max version"]
};

const PROCEED_KEYWORDS = [
  "yes", "yeah", "yep", "sure", "ok", "okay", "do it",
  "go ahead", "proceed", "create it", "make it", "translate it",
  "yes please", "that sounds good", "perfect", "sounds good", "lets do it"
];

function detectModificationRequest(message: string): ModificationDetection {
  const lower = message.toLowerCase();

  let detectedType: ModificationType | null = null;
  let maxMatches = 0;

  for (const [type, patterns] of Object.entries(MODIFICATION_PATTERNS)) {
    const matches = patterns.filter(p => lower.includes(p)).length;
    if (matches > maxMatches) {
      maxMatches = matches;
      detectedType = type as ModificationType;
    }
  }

  // Fallback: check for generic numeric duration patterns like "25 minute version"
  // This catches cases like "create a 25 minute version" which aren't in the specific patterns
  if (!detectedType) {
    const numericDurationMatch = lower.match(/(\d+)\s*(?:min|minute|minutes|hr|hour|hours)/);
    if (numericDurationMatch) {
      detectedType = "duration";
      maxMatches = 1;
    }
  }

  if (!detectedType || maxMatches < 1) {
    return { isModification: false, type: null, direction: null, targetFields: null, targetLanguage: null };
  }

  let direction: "shorter" | "longer" | null = null;
  for (const [dir, patterns] of Object.entries(DIRECTION_PATTERNS)) {
    if (patterns.some(p => lower.includes(p))) {
      direction = dir as "shorter" | "longer";
      break;
    }
  }

  const targetLanguage = detectedType === "translation" ? extractTargetLanguage(lower) : null;

  return {
    isModification: true,
    type: detectedType,
    direction,
    targetFields: null,
    targetLanguage
  };
}

function extractTargetLanguage(lower: string): string | null {
  const languages = [
    { name: "russian", patterns: ["russian", "in russian"] },
    { name: "spanish", patterns: ["spanish", "en español", "espanol"] },
    { name: "french", patterns: ["french", "in french"] },
    { name: "german", patterns: ["german", "in german"] },
    { name: "portuguese", patterns: ["portuguese", "in portuguese"] },
    { name: "chinese", patterns: ["chinese", "mandarin", "in chinese"] },
    { name: "japanese", patterns: ["japanese", "in japanese"] },
    { name: "korean", patterns: ["korean", "in korean"] },
    { name: "arabic", patterns: ["arabic", "in arabic"] },
    { name: "hindi", patterns: ["hindi", "in hindi"] },
    { name: "italian", patterns: ["italian", "in italian"] },
    { name: "dutch", patterns: ["dutch", "in dutch"] },
    { name: "polish", patterns: ["polish", "in polish"] },
    { name: "vietnamese", patterns: ["vietnamese", "in vietnamese"] },
    { name: "greek", patterns: ["greek", "in greek"] },
    { name: "hebrew", patterns: ["hebrew", "in hebrew"] },
    { name: "thai", patterns: ["thai", "in thai"] },
    { name: "urdu", patterns: ["urdu", "in urdu"] },
    { name: "swahili", patterns: ["swahili", "in swahili"] },
    { name: "tagalog", patterns: ["tagalog", "in tagalog"] },
    { name: "creole", patterns: ["creole", "in creole", "haitian creole"] },
  ];

  for (const lang of languages) {
    if (lang.patterns.some(p => lower.includes(p))) {
      return lang.name;
    }
  }

  return null;
}

function getModificationSystemPrompt(modType: "duration" | "translation", direction: "shorter" | "longer" | null, isEditing: boolean, targetLanguage?: string | null, targetDuration?: number | null): string {
  const basePrompt = `You are an AI assistant helping a teacher modify lesson content.

The lesson content will be provided below. Analyze it and prepare modifications based on the teacher's request.

IMPORTANT: Your response must be a JSON object with this exact structure:
{
  "modifiedFields": {
    "field_name": { "html": "modified content", "original_length": 100 }
  },
  "summary": "Brief description of changes made"
}`;

  if (modType === "duration") {
    const durationInstruction = targetDuration
      ? ` Target duration: EXACTLY ${targetDuration} minutes. The lesson outline table MUST show activities totaling exactly ${targetDuration} minutes.`
      : "";

    if (direction === "shorter") {
      return basePrompt + `

For a SHORTER version (condensed):
- Remove less essential activities
- Shorter warm-ups and cool-downs
- Focus on core learning objectives
- Keep the most impactful parts
- Reduce time on practice/repetition
- Do NOT modify these fields (return original content unchanged): learning_objectives, vocabulary, materials, vapa_text_block, ncas_text_block, assessment${durationInstruction}`;
    } else if (direction === "longer") {
      return basePrompt + `

For a LONGER version (expanded):
- Add more practice time
- Include additional examples or activities
- Extend reflection/discussion time
- Add enrichment activities
- More repetition for mastery
- Do NOT modify these fields (return original content unchanged): learning_objectives, vocabulary, materials, vapa_text_block, ncas_text_block, assessment${durationInstruction}`;
    } else {
      return basePrompt + `

For a different duration version:
- Adjust activities to fit target duration
- Scale practice time appropriately
- Maintain core learning objectives
- Do NOT modify these fields (return original content unchanged): learning_objectives, vocabulary, materials, vapa_text_block, ncas_text_block, assessment${durationInstruction}`;
    }
  }

  if (modType === "translation") {
    return basePrompt + `

For a TRANSLATION into ${targetLanguage || "the target language"}:
- Translate all content into ${targetLanguage || "the target language"}
- Maintain the structure and formatting
- Keep HTML tags intact
- Preserve all formatting (bold, italic, lists, etc.)
- CRITICAL - SONG LYRICS AND CHANTS: Do NOT translate songs, chants, or call-and-response lyrics. Keep them 100% in English. If a Japanese equivalent exists, you MAY add it in parentheses AFTER the English, but the English version must remain intact. Example: "Twinkle Twinkle Little Star (きらきら星)"
- Do NOT translate tongue twisters (mark as " [English tongue twister] ")`;
  }

  return basePrompt;
}

function getTranslationQuestionsSystemPrompt(targetLanguage: string): string {
  return `You are an AI assistant helping a teacher translate a lesson into ${targetLanguage}.

The teacher wants to translate this lesson. Before creating the translation, you need to understand their requirements.

IMPORTANT: You are ONLY allowed to ask questions. You are NOT allowed to generate any translated content yourself. Wait for the teacher to click the "Proceed" button.

Ask the teacher the following questions (one at a time, wait for each answer):

1. "Who are your students? (heritage speakers, language learners, or immersion students)"

2. "Should I translate the songs and chants, or keep them in English with the translation noted?"

3. "Any specific terminology preferences? For example, should musical terms stay in Italian (tempo, dynamics) or be translated?"

After getting answers to all three questions, tell the teacher EXACTLY this message:
"I've gathered your requirements. Click 'Proceed' when ready to create the translation."

Do NOT generate any translated content. Do NOT try to process the translation. Just ask questions and then tell the teacher to click Proceed.`;
}

function getDurationQuestionsSystemPrompt(): string {
  return `You are an AI assistant helping a teacher modify a lesson's duration.

The teacher wants to create a modified version with different timing. Before creating the modification, you need to understand their requirements.

IMPORTANT: You are ONLY allowed to ask questions. You are NOT allowed to generate any modified content yourself. Wait for the teacher to click the "Proceed" button.

Ask the teacher the following questions (one at a time, wait for each answer):

1. "What is the target duration for this version? (e.g., 30 minutes, 45 minutes)"

2. "What should I focus on preserving? (core activities, practice time, creative expression, etc.)"

After getting answers to both questions, tell the teacher EXACTLY this message:
"I've gathered your requirements. Click 'Proceed' when ready to create the modified version."

Do NOT generate any modified content. Do NOT try to process the modification. Just ask questions and then tell the teacher to click Proceed.`;
}

interface LessonBasic {
  id: string;
  title: string;
  lesson_number: number;
  course_id: string;
  courses: { id?: string; title?: string; grade?: string } | null | unknown;
  lesson_outline?: string;
  learning_objectives?: string;
  vocabulary?: string;
  materials?: string;
  vapa_text_block?: string;
  ncas_text_block?: string;
  welcome_opening?: string;
  actual_class_expectations?: string;
  warm_up?: string;
  lesson_hook?: string;
  main_activity?: string;
  instrument_expectations?: string;
  reflection?: string;
  closing_ceremony?: string;
  assessment?: string;
}

function unescapeJsonString(text: string): string {
  return text
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\');
}

interface TruncationDetection {
  isTruncated: boolean;
  reason: string | null;
  missingFields: string[];
  needsRetry: boolean;
}

function detectTruncation(aiResponse: string, expectedFields: string[]): TruncationDetection {
  const result: TruncationDetection = {
    isTruncated: false,
    reason: null,
    missingFields: [],
    needsRetry: false
  };

  // Check for literal ellipsis placeholder (AI output "..." to indicate skipped content)
  if (/\.\.\.|…/.test(aiResponse)) {
    const ellipsisMatches = aiResponse.match(/"(\.\.\.|…)"|(\.\.\.|…)(?=\s*[",}\]])/g);
    if (ellipsisMatches) {
      result.isTruncated = true;
      result.reason = `AI used literal ellipsis placeholder: ${ellipsisMatches.join(', ')}`;
      result.needsRetry = true;
    }
  }

  // Check if JSON appears to be cut off mid-field (ends with opening quote but no closing)
  const lastChunk = aiResponse.slice(-200);
  if (lastChunk.includes('"html": "') && !lastChunk.match(/"[^"]*"\s*[,\}]/)) {
    result.isTruncated = true;
    result.reason = 'JSON appears cut off mid-field value';
    result.needsRetry = true;
  }

  // Check for incomplete table structures in the response
  const tableOpenCount = (aiResponse.match(/<table[^>]*>/g) || []).length;
  const tableCloseCount = (aiResponse.match(/<\/table>/g) || []).length;
  if (tableOpenCount > tableCloseCount && tableOpenCount > 0) {
    result.isTruncated = true;
    result.reason = `Table structure incomplete (${tableOpenCount} open, ${tableCloseCount} close)`;
    result.needsRetry = true;
  }

  // Check for unclosed style attributes (style="...value" without proper ending)
  const styleAttrMatches = aiResponse.match(/style=["'][^"']*$/g);
  if (styleAttrMatches && styleAttrMatches.length > 0) {
    result.isTruncated = true;
    result.reason = `Unclosed style attribute: "${styleAttrMatches[styleAttrMatches.length - 1].slice(-50)}"`;
    result.needsRetry = true;
  }

  // Check for expected fields that are missing from the response
  const foundFields: string[] = [];
  const fieldPattern = /"(\w+)":\s*\{\s*["']html["']/g;
  let match;
  while ((match = fieldPattern.exec(aiResponse)) !== null) {
    foundFields.push(match[1]);
  }

  // Normalize field names using shared helper for comparison
  const normalizedFound = foundFields.map(normalizeFieldName);
  const normalizedExpected = expectedFields.map(normalizeFieldName);

  for (const expected of normalizedExpected) {
    if (!normalizedFound.includes(expected)) {
      result.missingFields.push(expected);
    }
  }

  // If more than 2 expected fields are missing, likely truncation
  if (result.missingFields.length > 2 && !result.isTruncated) {
    result.isTruncated = true;
    result.reason = `Missing ${result.missingFields.length} expected fields: ${result.missingFields.join(', ')}`;
    result.needsRetry = true;
  }

  // Check if response ends abruptly (no proper closing braces)
  const trimmedResponse = aiResponse.trim();
  if (trimmedResponse.endsWith('"') || trimmedResponse.endsWith(',')) {
    const afterLastBrace = trimmedResponse.substring(trimmedResponse.lastIndexOf('}') + 1);
    if (afterLastBrace.includes('"') && !afterLastBrace.includes('}')) {
      result.isTruncated = true;
      result.reason = 'Response ends abruptly without proper JSON closure';
      result.needsRetry = true;
    }
  }

  if (result.isTruncated) {
    console.log(`[TRUNCATION DETECT] Detected truncation: ${result.reason}`);
    console.log(`[TRUNCATION DETECT] Missing fields: ${result.missingFields.join(', ') || 'none'}`);
    console.log(`[TRUNCATION DETECT] Needs retry: ${result.needsRetry}`);
  }

  return result;
}

// Helper function to extract complete field objects from potentially truncated JSON
function extractFieldsFromTruncatedJson(text: string): Record<string, unknown> | null {
  console.log("[EXTRACT] Starting field extraction, text length:", text.length);
  const result: Record<string, unknown> = {};

  // Find all "field_name": { patterns
  const fieldStartPattern = /(["'])(\w+)\1\s*:\s*\{\s*(["'])html\3\s*:/gi;

  let match;
  while ((match = fieldStartPattern.exec(text)) !== null) {
    const fieldName = match[2];
    const startPos = match.index + match[0].length;

    // Find the opening quote of the HTML content
    const contentStartMatch = text.slice(startPos).match(/^\s*(["'``])/);
    if (!contentStartMatch) continue;
    const quoteChar = contentStartMatch[1];
    const contentStart = startPos + contentStartMatch[0].length;

    // Find the closing quote (not inside HTML entities or HTML tag attributes)
    // We need to track when we're inside an HTML tag (<tag ...>) and ignore quotes inside attribute values
    let contentEnd = contentStart;
    let inEntity = false;
    let inHtmlTag = false;
    let i = contentStart;
    while (i < text.length) {
      const char = text[i];
      if (char === '&') {
        inEntity = true;
      } else if (char === ';') {
        inEntity = false;
      } else if (char === '<') {
        inHtmlTag = true;
      } else if (char === '>') {
        inHtmlTag = false;
      } else if (char === '\\') {
        // Skip escaped character (e.g., \" in JSON)
        i++;
      } else if (char === quoteChar && !inEntity && !inHtmlTag) {
        contentEnd = i;
        break;
      }
      i++;
    }

    const rawHtmlContent = text.slice(contentStart, contentEnd);
    const htmlContent = unescapeJsonString(rawHtmlContent);
    console.log(`[EXTRACT] Field ${fieldName} raw (${rawHtmlContent.length} chars): "${rawHtmlContent.substring(0, 150)}..."`);
    if (!htmlContent) continue;

    // Validate: extracted content should start with < (HTML tag) or be a short valid string
    const isValidHtml = htmlContent.trim().startsWith('<');

    // Additional check for truncated HTML: if it starts with < but is suspiciously short for HTML
    // Real HTML content for a lesson field should be at least 50 chars
    const isSuspiciouslyShort = isValidHtml && htmlContent.length < 50;

    // Check if HTML is likely incomplete (opens tags but doesn't close them properly)
    let appearsComplete = true;
    if (isValidHtml && htmlContent.length >= 50) {
      // Count angle brackets - if more opening than closing, likely truncated
      const openTags = (htmlContent.match(/<[a-zA-Z][^>]*>/g) || []).length;
      const closeTags = (htmlContent.match(/<\/[a-zA-Z][^>]*>/g) || []).length;
      const selfClosing = (htmlContent.match(/<[a-zA-Z][^>]*\/>/g) || []).length;
      // Allow some imbalance but not gross (e.g., 5 opens vs 0 closes is bad)
      if (openTags > 3 && closeTags === 0 && !selfClosing) {
        appearsComplete = false;
        console.log(`[EXTRACT] WARNING: Field ${fieldName} appears incomplete (${openTags} open tags, ${closeTags} close tags, ${selfClosing} self-closing)`);
      }

      // Enhanced table completeness check
      if (appearsComplete && htmlContent.includes('<table')) {
        if (!htmlContent.includes('</table>')) {
          appearsComplete = false;
          console.log(`[EXTRACT] WARNING: Field ${fieldName} has <table> but no </table>, marking as truncated`);
        }
        // Also check for incomplete row/cell structure in tables
        const tableOpenCount = (htmlContent.match(/<table[^>]*>/g) || []).length;
        const tableCloseCount = (htmlContent.match(/<\/table>/g) || []).length;
        if (tableOpenCount > 0 && tableOpenCount !== tableCloseCount) {
          appearsComplete = false;
          console.log(`[EXTRACT] WARNING: Field ${fieldName} has unbalanced table tags (${tableOpenCount} open, ${tableCloseCount} close), marking as truncated`);
        }
      }

      // Check for literal "..." or "…" placeholder (AI indicating skipped/omitted content)
      const trimmedContent = htmlContent.trim();
      if (trimmedContent === '...' || trimmedContent === '…' || trimmedContent === '"..."' || trimmedContent === '"…"') {
        appearsComplete = false;
        console.log(`[EXTRACT] WARNING: Field ${fieldName} contains literal placeholder (${trimmedContent}), marking as truncated`);
      }

      // Check for suspiciously truncated style attribute values
      // Pattern: style="...value" where value ends mid-word (no semicolon, no closing quote properly)
      const styleAttrMatch = htmlContent.match(/style=["']([^"']*)$/);
      if (styleAttrMatch && styleAttrMatch[1].length > 0) {
        const styleValue = styleAttrMatch[1];
        // If it doesn't end with a proper terminator and is reasonably long, it's truncated
        if (!styleValue.match(/[;"']\s*$/) && styleValue.length > 20) {
          appearsComplete = false;
          console.log(`[EXTRACT] WARNING: Field ${fieldName} has truncated style attribute (ends with: "${styleValue.slice(-30)}"), marking as truncated`);
        }
      }
    }

    if (!isValidHtml || isSuspiciouslyShort || !appearsComplete) {
      if (isSuspiciouslyShort || !appearsComplete) {
        console.log(`[EXTRACT] WARNING: Field ${fieldName} content appears truncated (${htmlContent.length} chars, starts: ${htmlContent.substring(0, 80)}...), skipping`);
      } else {
        console.log(`[EXTRACT] WARNING: Field ${fieldName} content appears truncated (no HTML, ${htmlContent.length} chars), skipping`);
      }
      continue;
    }

    const finalName = normalizeFieldName(fieldName);
    if (finalName && htmlContent && !finalName.includes('_html') && !finalName.includes('original')) {
      result[finalName] = { html: htmlContent, original_length: htmlContent.length };
    }
  }

  if (Object.keys(result).length > 0) {
    console.log("[EXTRACT] Successfully extracted", Object.keys(result).length, "fields:", Object.keys(result).join(', '));
    for (const [key, val] of Object.entries(result)) {
      const fieldVal = val as { html?: string };
      console.log(`[EXTRACT]   ${key}: ${fieldVal?.html?.length || 0} chars, content: ${fieldVal?.html?.substring(0, 100)}...`);
    }
    return { modifiedFields: result };
  }
  console.log("[EXTRACT] No fields extracted");
  return null;
}

// Batch translation system prompt - for a specific set of fields
function getBatchTranslationSystemPrompt(fieldsToTranslate: string[], targetLanguage: string): string {
  const field = fieldsToTranslate[0];

  return `You are translating ONE specific field of a lesson into ${targetLanguage}.

FIELD TO TRANSLATE: ${field}

CRITICAL INSTRUCTIONS:
1. You are translating ONLY the field shown above
2. You MUST output the COMPLETE translated field - all content must be translated
3. Every HTML tag must be properly closed: <table> needs </table>, <tr> needs </tr>, <td> needs </td>, etc.
4. Do NOT truncate, shorten, or omit any content
5. Do NOT invent or hallucinate content
6. If the original content has tables, translate ALL rows and ALL cells completely

CRITICAL - SONG LYRICS AND CHANTS: Do NOT translate songs, chants, or call-and-response lyrics. Keep them 100% in English. If a translation is helpful, you MAY add it in parentheses AFTER the English.

Respond with ONLY this JSON (no markdown, no explanation):
{"modifiedFields":{"${field}":{"html":"[complete translated HTML with all tags properly closed]","original_length":N}}}`;
}

// Log translation failure to database
async function logTranslationFailure(
  userId: string,
  lessonId: string,
  batchNumber: number,
  failedFields: string[],
  errorType: string,
  errorMessage: string,
  aiResponseLength: number,
  supabase: any
): Promise<void> {
  try {
    await supabase
      .from("translation_failures")
      .insert({
        user_id: userId,
        lesson_id: lessonId,
        batch_number: batchNumber,
        failed_fields: failedFields,
        error_type: errorType,
        error_message: errorMessage,
        ai_response_length: aiResponseLength
      });
  } catch (err) {
    console.error("[MODIFY API] Failed to log translation failure:", err);
  }
}

// Run a single translation batch - returns fields on success, error details on failure
async function runTranslationBatch(
  fieldsToTranslate: string[],
  allFieldsContent: string,
  messages: Array<{ role: string; content: string }>,
  targetLanguage: string,
  userId: string,
  lessonId: string,
  batchNumber: number,
  supabase: any,
  apiKey: string
): Promise<{
  fields: Record<string, { html: string; original_length: number }>;
} | {
  error: {
    errorType: string;
    failedFields: string[];
    errorMessage: string;
    aiResponseLength: number;
  };
}> {
  const systemPrompt = getBatchTranslationSystemPrompt(fieldsToTranslate, targetLanguage);

  const lessonContextMessage = {
    role: "user" as const,
    content: `Please translate these fields of the lesson:\n\n${allFieldsContent}`
  };

  const finalMessages = [
    lessonContextMessage,
    ...messages.map((m: { role: string; content: string }) => ({ role: m.role, content: m.content })),
    { role: "user" as const, content: "Please translate the assigned fields now." }
  ];

  console.log(`[MODIFY API] Batch ${batchNumber}: Translating fields: ${fieldsToTranslate.join(', ')}`);

  let aiResponse = "";
  let streamSuccess = false;
  let attempts = 0;
  const maxStreamAttempts = 2;

  while (!streamSuccess && attempts < maxStreamAttempts) {
    attempts++;

    let response;
    try {
      response = await fetch(ANTHROPIC_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: MODIFICATION_MODEL,
          max_tokens: MAX_TOKENS,
          stream: true,
          system: systemPrompt,
          messages: finalMessages.map((m: { role: string; content: string }) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });
    } catch (err) {
      console.error(`[MODIFY API] Batch ${batchNumber} network error:`, err);
      return {
        error: {
          errorType: "network_error",
          failedFields: fieldsToTranslate,
          errorMessage: "Network error. Please check your connection and try again.",
          aiResponseLength: 0
        }
      };
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[MODIFY API] Batch ${batchNumber} API error:`, response.status, errorText);
      return {
        error: {
          errorType: "api_error",
          failedFields: fieldsToTranslate,
          errorMessage: `AI API error (${response.status}). Please try again.`,
          aiResponseLength: 0
        }
      };
    }

    try {
      let charCount = 0;
      for await (const chunk of streamAnthropicResponse(response)) {
        aiResponse += chunk;
        charCount += chunk.length;
        if (charCount % 1000 === 0) {
          await new Promise(resolve => setImmediate(resolve));
        }
      }
      streamSuccess = true;
    } catch (streamErr) {
      console.error(`[MODIFY API] Batch ${batchNumber} stream error:`, streamErr);
      if (attempts >= maxStreamAttempts) {
        return {
          error: {
            errorType: "stream_error",
            failedFields: fieldsToTranslate,
            errorMessage: "Failed to process AI response. Please try again.",
            aiResponseLength: aiResponse.length
          }
        };
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  console.log(`[MODIFY API] Batch ${batchNumber}: Stream completed, ${aiResponse.length} chars`);

  // Extract fields from response
  let jsonStr = "";

  // Try code block first
  const codeBlockMatch = aiResponse.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch && codeBlockMatch[1]) {
    jsonStr = codeBlockMatch[1].trim();
  }

  // Try to find JSON in response
  if (!jsonStr || !jsonStr.includes('"modifiedFields"')) {
    const firstBrace = aiResponse.indexOf('{');
    const lastBrace = aiResponse.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      jsonStr = aiResponse.substring(firstBrace, lastBrace + 1);
    }
  }

  if (!jsonStr) {
    await logTranslationFailure(userId, lessonId, batchNumber, fieldsToTranslate, "parse_error", "No JSON found in response", aiResponse.length, supabase);
    return {
      error: {
        errorType: "parse_error",
        failedFields: fieldsToTranslate,
        errorMessage: "Could not parse AI response. Please try again.",
        aiResponseLength: aiResponse.length
      }
    };
  }

  let parsed: Record<string, unknown> | null = null;
  try {
    parsed = JSON.parse(jsonStr);
  } catch (parseErr) {
    // Try field-by-field extraction
    console.log(`[MODIFY API] Batch ${batchNumber}: JSON parse failed, attempting field extraction`);
    parsed = extractFieldsFromTruncatedJson(aiResponse);
  }

  if (!parsed) {
    await logTranslationFailure(userId, lessonId, batchNumber, fieldsToTranslate, "parse_error", "Failed to extract fields from response", aiResponse.length, supabase);
    return {
      error: {
        errorType: "parse_error",
        failedFields: fieldsToTranslate,
        errorMessage: "Failed to extract fields from AI response. Please try again.",
        aiResponseLength: aiResponse.length
      }
    };
  }

  const rawFields = parsed.modifiedFields || parsed.modified_fields || {};

  // Normalize field keys
  const normalizedFields: Record<string, { html?: string; original_length?: number }> = {};
  for (const [key, value] of Object.entries(rawFields)) {
    const canonicalKey = normalizeFieldName(key);
    if (!normalizedFields[canonicalKey]) {
      normalizedFields[canonicalKey] = value as { html?: string; original_length?: number };
    }
  }

  // Check which fields were actually translated vs returned as original
  const translatedFields = fieldsToTranslate.filter(f => {
    const field = normalizedFields[f];
    return field && field.html && field.html.length > 0;
  });

  const missingFields = fieldsToTranslate.filter(f => {
    const field = normalizedFields[f];
    return !field || !field.html || field.html.length === 0;
  });

  console.log(`[MODIFY API] Batch ${batchNumber}: Translated ${translatedFields.length}/${fieldsToTranslate.length} fields`);
  console.log(`[MODIFY API] Batch ${batchNumber}: Missing fields: ${missingFields.join(', ') || 'none'}`);

  // Check for truncation indicators
  const hasTruncation =
    /\<table[^>]*\>\s*\<colgroup\>/.test(aiResponse) &&
    !/\<\/table\>/.test(aiResponse.substring(aiResponse.indexOf('<table')));

  if (missingFields.length > 0 || hasTruncation) {
    const errorType = hasTruncation ? "truncation" : "missing_fields";
    const errorMessage = hasTruncation
      ? "AI response was truncated. Some fields may be incomplete."
      : `Missing fields: ${missingFields.join(', ')}`;

    await logTranslationFailure(userId, lessonId, batchNumber, missingFields.length > 0 ? missingFields : fieldsToTranslate, errorType, errorMessage, aiResponse.length, supabase);

    return {
      error: {
        errorType,
        failedFields: missingFields.length > 0 ? missingFields : fieldsToTranslate,
        errorMessage,
        aiResponseLength: aiResponse.length
      }
    };
  }

  // Return successfully extracted fields
  const resultFields: Record<string, { html: string; original_length: number }> = {};
  for (const [key, val] of Object.entries(normalizedFields)) {
    if (val && val.html) {
      resultFields[key] = { html: val.html, original_length: val.original_length || val.html.length };
    }
  }

  return { fields: resultFields };
}

export async function POST(request: Request) {
  const body = await request.json();
  const { message, lessonId, courseId, conversationHistory, editingVersionId, waitingForConfirmation, userSaidProceed, detectedLanguage, originalTargetLanguage, confirmationModificationType, confirmationModDirection, confirmationTargetDuration } = body;

  if (!message) {
    return NextResponse.json({ error: "Message is required" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = user.id;

  if (!lessonId) {
    return NextResponse.json({
      response: "No lesson selected. Please open a lesson first.",
      links: [],
      results: [],
      isModificationRequest: false,
    });
  }

  const { data: fullLesson } = await supabase
    .from("lessons")
    .select("id, title, lesson_number, course_id, total_time, courses(id, title, grade), lesson_outline, learning_objectives, vocabulary, materials, vapa_text_block, ncas_text_block, welcome_opening, actual_class_expectations, warm_up, lesson_hook, main_activity, instrument_expectations, reflection, closing_ceremony, assessment")
    .eq("id", lessonId)
    .single();

  if (!fullLesson) {
    return NextResponse.json({
      response: "Lesson not found.",
      links: [],
      results: [],
      isModificationRequest: false,
    });
  }

  const lessonWithCourse = fullLesson as unknown as LessonBasic;
  const courseData = lessonWithCourse.courses as { id?: string; title?: string; grade?: string } | null;
  const course = Array.isArray(courseData) ? courseData[0] : courseData;

  let editingVersionContent: Record<string, { html: string }> | null = null;

  if (editingVersionId) {
    const { data: versionData } = await supabase
      .from("lesson_versions")
      .select("content, version_name")
      .eq("id", editingVersionId)
      .single();
    if (versionData?.content) {
      editingVersionContent = versionData.content as Record<string, { html: string }>;
    }
  }

  const modificationDetection = detectModificationRequest(message);
  const userMessage = modificationDetection.isModification ? message : "";

  console.log("[MODIFY API] Initial modificationDetection:");
  console.log("[MODIFY API]   isModification:", modificationDetection.isModification);
  console.log("[MODIFY API]   type:", modificationDetection.type);
  console.log("[MODIFY API]   direction:", modificationDetection.direction);
  console.log("[MODIFY API]   targetLanguage:", modificationDetection.targetLanguage);
  console.log("[MODIFY API]   message:", message.substring(0, 200));

  const isVersionMode = true;
  let modificationPreview: Record<string, unknown> | null = null;
  let needsConfirmation = false;
  let suggestedVersionName = "";

  const modType = userSaidProceed && confirmationModificationType
    ? confirmationModificationType
    : modificationDetection.type;
  let modDirection = userSaidProceed && confirmationModificationType
    ? (confirmationModDirection || modificationDetection.direction)
    : modificationDetection.direction;
  const targetLanguage = userSaidProceed && originalTargetLanguage
    ? originalTargetLanguage
    : (modificationDetection.targetLanguage || detectedLanguage);

  // Extract target duration for duration modifications (used in AI prompt and version name)
  let modTargetDuration: number | null = null;
  if (modType === "duration") {
    // Use confirmationTargetDuration if available (from Proceed click), otherwise extract from message
    modTargetDuration = userSaidProceed ? (confirmationTargetDuration || extractTargetDuration(message)) : extractTargetDuration(message);
    console.log("[MODIFY API] modTargetDuration:", modTargetDuration, "(userSaidProceed:", userSaidProceed, ")");
  }

  // If direction still null but this is a duration modification, try to determine from numeric comparison
  if (!modDirection && modType === "duration") {
    const currentDuration = parseDuration(fullLesson.total_time);
    console.log("[MODIFY API] Duration comparison: current=", currentDuration, "target=", modTargetDuration);
    if (currentDuration && modTargetDuration) {
      if (modTargetDuration < currentDuration) {
        modDirection = "shorter";
        console.log("[MODIFY API] Set direction to 'shorter' based on duration comparison");
      } else if (modTargetDuration > currentDuration) {
        modDirection = "longer";
        console.log("[MODIFY API] Set direction to 'longer' based on duration comparison");
      }
    }
  }

  console.log("[MODIFY API] After logic assignment:");
  console.log("[MODIFY API]   modType:", modType);
  console.log("[MODIFY API]   modDirection:", modDirection);
  console.log("[MODIFY API]   targetLanguage:", targetLanguage);
  console.log("[MODIFY API]   userSaidProceed:", userSaidProceed);

  if ((modificationDetection.isModification || userSaidProceed) && modType) {
    const effectiveModType = modType as "duration" | "translation";

    const lessonTitle = fullLesson.title;
    const lessonNumber = fullLesson.lesson_number;
    const courseTitle = course?.title || "Unknown";
    const courseGrade = course?.grade || "Unknown";

    // Helper to get field content from editingVersionContent or fullLesson
    const getFieldContent = (fieldName: string): string => {
      const versionField = editingVersionContent as Record<string, { html?: string }> | null;
      return versionField?.[fieldName]?.html || (fullLesson as Record<string, unknown>)[fieldName] as string || "(empty)";
    };

    // For duration: only include fields that can be modified (skip static fields like standards, vocab, etc.)
    // For translation: include all 15 fields
    const isDurationMod = effectiveModType === "duration";

    // The 9 modifiable fields for duration modifications
    const DURATION_MODIFIABLE_FIELDS = [
      'lesson_outline',
      'welcome_opening',
      'actual_class_expectations',
      'warm_up',
      'lesson_hook',
      'main_activity',
      'instrument_expectations',
      'reflection',
      'closing_ceremony'
    ];

    // All 15 fields for translation
    const ALL_FIELDS = [
      { key: 'lesson_outline', label: 'LESSON OUTLINE' },
      { key: 'learning_objectives', label: 'LEARNING OBJECTIVES' },
      { key: 'vocabulary', label: 'VOCABULARY' },
      { key: 'materials', label: 'MATERIALS' },
      { key: 'welcome_opening', label: 'WELCOME AND OPENING CHECK-IN' },
      { key: 'actual_class_expectations', label: 'CLASS EXPECTATIONS AND PROCEDURES' },
      { key: 'warm_up', label: 'WARM UP' },
      { key: 'lesson_hook', label: 'LESSON HOOK' },
      { key: 'main_activity', label: 'MAIN ACTIVITY' },
      { key: 'instrument_expectations', label: 'INSTRUMENT EXPECTATIONS' },
      { key: 'reflection', label: 'REFLECTION' },
      { key: 'closing_ceremony', label: 'CLOSING CEREMONY' },
      { key: 'assessment', label: 'ASSESSMENT' },
      { key: 'vapa_text_block', label: 'VAPA STANDARDS' },
      { key: 'ncas_text_block', label: 'NCAS STANDARDS' },
    ];

    const fieldsToInclude = isDurationMod
      ? ALL_FIELDS.filter(f => DURATION_MODIFIABLE_FIELDS.includes(f.key))
      : ALL_FIELDS;

    const fieldsContent = fieldsToInclude
      .map(f => `--- ${f.label} ---\n${getFieldContent(f.key)}`)
      .join('\n\n');

    let modificationLessonContent = `FULL CONTENT OF THIS LESSON:

Lesson: ${lessonTitle}
Course: ${courseTitle}
Grade: ${courseGrade}
Lesson Number: ${lessonNumber}
${isDurationMod ? "(Note: Only modify the fields below. Do not change any other fields.)" : ""}

${fieldsContent}
`;

    if (waitingForConfirmation && userSaidProceed) {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        return NextResponse.json({
          response: "AI is not configured. Please contact an administrator.",
          links: [],
          results: [],
          isModificationRequest: true,
        });
      }

      let mergedFields: Record<string, { html: string; original_length: number }> = {};

      // TRANSLATION: One API call per field
      if (effectiveModType === "translation") {
        console.log("[MODIFY API] Starting per-field translation for lesson:", lessonId);

        const allFields = [
          'lesson_outline', 'learning_objectives', 'vocabulary', 'materials',
          'vapa_text_block', 'ncas_text_block', 'welcome_opening', 'actual_class_expectations',
          'warm_up', 'lesson_hook', 'main_activity', 'instrument_expectations',
          'reflection', 'closing_ceremony', 'assessment'
        ];

        for (let i = 0; i < allFields.length; i++) {
          const field = allFields[i];
          console.log(`[MODIFY API] Translating field ${i + 1}/${allFields.length}: ${field}`);

          // Skip empty fields - no need to translate
          const originalContent = getFieldContent(field);
          const strippedText = originalContent.replace(/<[^>]*>/g, '').trim();
          if (!originalContent || strippedText === "" || originalContent === "(empty)") {
            console.log(`[MODIFY API] Skipping ${field} - field is empty`);
            continue;
          }

          // Build content for THIS field only - not the full lesson
          const singleFieldContent = `LESSON: ${lessonTitle} (Grade ${courseGrade})

TRANSLATE THIS FIELD: ${field}

Original content:
${originalContent}`;

          const result = await runTranslationBatch(
            [field],
            singleFieldContent,
            conversationHistory || [],
            targetLanguage || "the target language",
            userId,
            lessonId,
            i + 1,
            supabase,
            apiKey
          );

          if ('error' in result) {
            return NextResponse.json({
              response: `Translation failed: ${result.error.errorMessage} Failed field: ${field}. Please try again.`,
              links: [],
              results: [],
              isModificationRequest: true,
              needsConfirmation: false,
              translationFailed: true,
              failedFields: [field],
              failedBatch: i + 1,
              errorType: result.error.errorType
            });
          }

          // Only add fields with actual translated content
          const translatedContent = result.fields[field]?.html || "";
          const translatedStripped = translatedContent.replace(/<[^>]*>/g, '').trim();
          if (translatedStripped !== "") {
            mergedFields[field] = result.fields[field];
            console.log(`[MODIFY API] Field ${field} translated successfully`);
          } else {
            console.log(`[MODIFY API] Field ${field} translated to empty - skipping`);
          }
        }

        console.log(`[MODIFY API] Translation complete. ${Object.keys(mergedFields).length} fields with content.`);
        console.log(`[MODIFY API] mergedFields keys before save:`, Object.keys(mergedFields).join(', '));
      } else {
        // DURATION: Single call (simplified, no retry, 160K tokens)
        const systemPrompt = getModificationSystemPrompt(effectiveModType, modDirection, !!editingVersionId, targetLanguage, modTargetDuration);

        const lessonContextMessage = {
          role: "user" as const,
          content: `Please modify this lesson content:\n\n${modificationLessonContent}`
        };

        const finalUserMessage = userMessage.trim() || "Proceed with creating the version now.";
        const messages = conversationHistory
          ? [lessonContextMessage, ...conversationHistory.map((m: { role: string; content: string }) => ({ role: m.role, content: m.content })), { role: "user", content: finalUserMessage }]
          : [lessonContextMessage, { role: "user", content: finalUserMessage }];

        console.log("[MODIFY API] Starting duration modification, max_tokens:", MAX_TOKENS);

        let aiResponse = "";
        let streamSuccess = false;
        let attempts = 0;
        const maxStreamAttempts = 2;

        while (!streamSuccess && attempts < maxStreamAttempts) {
          attempts++;

          let response;
          try {
            response = await fetch(ANTHROPIC_API_URL, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-api-key": apiKey,
                "anthropic-version": "2023-06-01",
              },
              body: JSON.stringify({
                model: MODIFICATION_MODEL,
                max_tokens: MAX_TOKENS,
                stream: true,
                system: systemPrompt,
                messages: messages.map((m: { role: string; content: string }) => ({
                  role: m.role,
                  content: m.content,
                })),
              }),
            });
          } catch (err) {
            return NextResponse.json({
              response: "Network error. Please try again.",
              links: [],
              results: [],
              isModificationRequest: true,
            });
          }

          if (!response.ok) {
            const errorText = await response.text();
            console.error("Anthropic API error:", response.status, errorText);
            return NextResponse.json({
              response: `AI API error (${response.status}). Please try again.`,
              links: [],
              results: [],
              isModificationRequest: true,
            });
          }

          try {
            let charCount = 0;
            for await (const chunk of streamAnthropicResponse(response)) {
              aiResponse += chunk;
              charCount += chunk.length;
              if (charCount % 1000 === 0) {
                await new Promise(resolve => setImmediate(resolve));
              }
            }
            streamSuccess = true;
          } catch (streamErr) {
            console.error(`[MODIFY API] Stream attempt ${attempts} failed:`, streamErr);
            if (attempts >= maxStreamAttempts) {
              return NextResponse.json({
                response: "Failed to process AI response. Please try again.",
                links: [],
                results: [],
                isModificationRequest: true,
              });
            }
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }

        console.log(`[MODIFY API] Duration stream completed: ${aiResponse.length} chars`);

        // Extract fields from response
        let jsonStr = "";
        const codeBlockMatch = aiResponse.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (codeBlockMatch && codeBlockMatch[1]) {
          jsonStr = codeBlockMatch[1].trim();
        }
        if (!jsonStr || !jsonStr.includes('"modifiedFields"')) {
          const firstBrace = aiResponse.indexOf('{');
          const lastBrace = aiResponse.lastIndexOf('}');
          if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
            jsonStr = aiResponse.substring(firstBrace, lastBrace + 1);
          }
        }

        if (!jsonStr) {
          return NextResponse.json({
            response: "Could not parse AI response. Please try again.",
            links: [],
            results: [],
            isModificationRequest: true,
          });
        }

        let parsed: Record<string, unknown> | null = null;
        try {
          parsed = JSON.parse(jsonStr);
        } catch (parseErr) {
          parsed = extractFieldsFromTruncatedJson(aiResponse);
        }

        if (!parsed || !parsed.modifiedFields) {
          return NextResponse.json({
            response: "Failed to extract fields from AI response. Please try again.",
            links: [],
            results: [],
            isModificationRequest: true,
          });
        }

        const rawFields = parsed.modifiedFields || parsed.modified_fields || {};
        for (const [key, value] of Object.entries(rawFields)) {
          const canonicalKey = normalizeFieldName(key);
          if (!mergedFields[canonicalKey]) {
            mergedFields[canonicalKey] = value as { html: string; original_length: number };
          }
        }
      }

      // Build modificationPreview from merged fields
      modificationPreview = { modifiedFields: mergedFields };

      // Validate all 15 fields are present; fill missing fields with original content
      const allFieldKeys = [
        'lesson_outline', 'learning_objectives', 'vocabulary', 'materials',
        'vapa_text_block', 'ncas_text_block', 'welcome_opening', 'actual_class_expectations',
        'warm_up', 'lesson_hook', 'main_activity', 'instrument_expectations',
        'reflection', 'closing_ceremony', 'assessment'
      ];

      const modifiedFields = modificationPreview.modifiedFields as Record<string, { html?: string; original_length?: number }>;
      const missingFields: string[] = [];

      for (const fieldKey of allFieldKeys) {
        if (!modifiedFields[fieldKey] || !modifiedFields[fieldKey].html) {
          missingFields.push(fieldKey);
          const fullLessonAny = fullLesson as unknown as Record<string, string>;
          const originalHtml = fullLessonAny[fieldKey] || "";
          if (originalHtml) {
            modifiedFields[fieldKey] = { html: originalHtml, original_length: originalHtml.length };
            console.log(`[MODIFY API] Filled missing field '${fieldKey}' with original content (${originalHtml.length} chars)`);
          }
        }
      }

      if (missingFields.length > 0) {
        console.log(`[MODIFY API] Missing fields filled from original: ${missingFields.join(', ')}`);
      }

      const timestamp = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

      if (effectiveModType === "translation" && targetLanguage) {
        suggestedVersionName = `${targetLanguage.charAt(0).toUpperCase() + targetLanguage.slice(1)} Translation - ${timestamp}`;
      } else if (effectiveModType === "duration") {
        const durationSuffix = modTargetDuration ? ` (${modTargetDuration} min)` : "";
        suggestedVersionName = `${modDirection === "shorter" ? "Shorter" : "Longer"} Version${durationSuffix} - ${timestamp}`;
      } else {
        suggestedVersionName = `Modified Version - ${timestamp}`;
      }

      // Check for duplicate version names and append (2), (3), etc. if needed
      const { data: existingVersions } = await supabase
        .from("lesson_versions")
        .select("version_name")
        .eq("lesson_id", lessonId)
        .is("deleted_at", null);

      if (existingVersions) {
        const existingNames = existingVersions.map(v => v.version_name);
        let finalName = suggestedVersionName;
        let counter = 2;

        while (existingNames.includes(finalName)) {
          finalName = `${suggestedVersionName} (${counter})`;
          counter++;
        }

        if (finalName !== suggestedVersionName) {
          console.log(`[MODIFY API] Duplicate version name detected, renamed to: ${finalName}`);
          suggestedVersionName = finalName;
        }
      }

      return NextResponse.json({
        response: `I've created "${suggestedVersionName}". This version is now loaded in the lesson view.`,
        links: [],
        results: [],
        isModificationRequest: true,
        needsConfirmation: false,
        modificationType: effectiveModType,
        modificationPreview,
        editingVersionId: editingVersionId || null,
        suggestedVersionName,
      });
    } else {
      const systemPrompt = effectiveModType === "translation"
        ? getTranslationQuestionsSystemPrompt(targetLanguage || detectedLanguage || "the target language")
        : getDurationQuestionsSystemPrompt();

      const messages = conversationHistory
        ? [...conversationHistory.map((m: { role: string; content: string }) => ({ role: m.role, content: m.content })), { role: "user", content: message }]
        : [{ role: "user", content: message }];

      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        return NextResponse.json({
          response: "AI is not configured. Please contact an administrator.",
          links: [],
          results: [],
          isModificationRequest: true,
        });
      }

      let response;
      try {
        response = await fetch(ANTHROPIC_API_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: MODIFICATION_MODEL,
            max_tokens: 1024,
            system: systemPrompt,
            messages: messages.map((m: { role: string; content: string }) => ({
              role: m.role,
              content: m.content,
            })),
          }),
        });
      } catch (err) {
        return NextResponse.json({
          response: "Network error. Please try again.",
          links: [],
          results: [],
          isModificationRequest: true,
        });
      }

      const result = await response.json();
      const aiResponse = result.content?.[0]?.text || "I'm having trouble understanding. Could you please rephrase your request?";

      return NextResponse.json({
        response: aiResponse,
        links: [],
        results: [],
        isModificationRequest: true,
        needsConfirmation: true,
        modificationType: modType,
        modificationDirection: modDirection,
        modificationTargetDuration: modTargetDuration,
        modificationPreview: null,
        suggestedVersionName,
      });
    }
  }

  // If user is answering questions during confirmation phase
  if (waitingForConfirmation && !userSaidProceed && confirmationModificationType) {
    const systemPrompt = confirmationModificationType === "translation"
      ? getTranslationQuestionsSystemPrompt(detectedLanguage || "the target language")
      : getDurationQuestionsSystemPrompt();

    const messages = conversationHistory
      ? [...conversationHistory.map((m: { role: string; content: string }) => ({ role: m.role, content: m.content })), { role: "user", content: message }]
      : [{ role: "user", content: message }];

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({
        response: "AI is not configured. Please contact an administrator.",
        links: [],
        results: [],
        isModificationRequest: true,
      });
    }

    let response;
    try {
      response = await fetch(ANTHROPIC_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: MODIFICATION_MODEL,
          max_tokens: 1024,
          system: systemPrompt,
          messages: messages.map((m: { role: string; content: string }) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });
      } catch (err) {
        return NextResponse.json({
          response: "Network error. Please try again.",
          links: [],
          results: [],
          isModificationRequest: true,
        });
      }

      const result = await response.json();
      const aiResponse = result.content?.[0]?.text || "I'm having trouble understanding. Could you please rephrase your answer?";

      return NextResponse.json({
        response: aiResponse,
        links: [],
        results: [],
        isModificationRequest: true,
        needsConfirmation: true,
        modificationType: confirmationModificationType,
        modificationDirection: confirmationModDirection || modificationDetection.direction,
        modificationTargetDuration: confirmationTargetDuration,
        modificationPreview: null,
        suggestedVersionName: "",
    });
  }

  // If no modification detected, provide general help
  const systemPrompt = `You are an AI assistant helping a teacher with lesson modifications.

You are in the Versions tab where teachers can create modified versions of lessons.
Available modification types:
- Duration: Make a lesson shorter or longer
- Translation: Translate a lesson into another language

If the teacher wants to make a modification, ask clarifying questions and then ask them to click "Proceed" when ready.
If the teacher is just asking questions, answer helpfully but remind them they can use the "Ask" tab for general questions.`;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({
      response: "AI is not configured. Please contact an administrator.",
      links: [],
      results: [],
      isModificationRequest: false,
    });
  }

  const messages = conversationHistory
    ? [...conversationHistory.map((m: { role: string; content: string }) => ({ role: m.role, content: m.content })), { role: "user", content: message }]
    : [{ role: "user", content: message }];

  let response;
  try {
    response = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: systemPrompt,
        messages: messages.map((m: { role: string; content: string }) => ({
          role: m.role,
          content: m.content,
        })),
      }),
    });
  } catch (err) {
    return NextResponse.json({
      response: "Network error. Please try again.",
      links: [],
      results: [],
      isModificationRequest: false,
    });
  }

  const result = await response.json();
  const aiResponse = result.content?.[0]?.text || "";

  return NextResponse.json({
    response: aiResponse,
    links: [],
    results: [],
    isModificationRequest: false,
  });
}
