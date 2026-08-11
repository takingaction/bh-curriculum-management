import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { findMatchesInContent, generateSnippet, TEXT_FIELDS_LIST } from "@/lib/html-utils";
import { searchLessons, getLessonDetails, listMyCourses } from "@/lib/search-utils";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-haiku-4-5";
const MODIFICATION_MODEL = "claude-sonnet-4-5";
const MAX_TOKENS = 1024;

const CURRICULUM_TRIGGER = "imc";

const TOOLS = [
  {
    name: "search_lessons",
    description: `Searches the curriculum database for lessons matching a query string.

Use this tool when the user wants to find lessons about a specific topic, concept, standard, or keyword.
The search looks across all lesson content including: lesson outlines, learning objectives, vocabulary,
materials, VAPA standards, NCAS standards, welcome activities, warm-ups, main activities, reflections, assessments, and more.

Returns a list of matching lessons with their titles, course information, grade levels, and relevant content snippets.

This tool accesses ONLY lessons the user has permission to view (based on their enrollment).`,
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The search query - can be a keyword, topic, concept, standard reference (e.g., 'voice', 'rhythm', 'Anchor Standard 4', 'notation', 'dynamics')"
        },
        grade: {
          type: "string",
          description: "Optional filter: Filter by grade level. Valid values: 'PK', 'K', '1', '2', '3', '4', '5', '6', or comma-separated list like '3,4,5'"
        },
        course_id: {
          type: "string",
          description: "Optional filter: Limit search to a specific course UUID"
        },
        discipline: {
          type: "string",
          description: "Optional filter: Filter by discipline. Values: 'MUSIC', 'DANCE', 'THEATRE'",
          enum: ["MUSIC", "DANCE", "THEATRE"]
        },
        max_results: {
          type: "number",
          description: "Maximum number of results to return (default: 10, max: 50)",
          default: 10
        }
      },
      required: ["query"]
    }
  },
  {
    name: "get_lesson_details",
    description: "Retrieves the full content of a specific lesson by ID. Use this to get complete lesson content after identifying a relevant lesson via search.",
    input_schema: {
      type: "object",
      properties: {
        lesson_id: {
          type: "string",
          description: "The UUID of the lesson"
        },
        sections: {
          type: "array",
          items: { type: "string" },
          description: "Optional: Specific sections to retrieve. If not provided, returns all 15 sections. Valid sections: lesson_outline, learning_objectives, vocabulary, materials, vapa_text_block, ncas_text_block, welcome_opening, actual_class_expectations, warm_up, lesson_hook, main_activity, instrument_expectations, reflection, closing_ceremony, assessment"
        }
      },
      required: ["lesson_id"]
    }
  },
  {
    name: "list_my_courses",
    description: "Lists all courses the user has access to, grouped by discipline and grade.",
    input_schema: {
      type: "object",
      properties: {}
    }
  }
];

function stripHtmlForAI(html: string): string {
  if (!html) return "";
  let text = html;

  text = text.replace(/<strong([^>]*)>/gi, "**");
  text = text.replace(/<\/strong>/gi, "**");
  text = text.replace(/<b([^>]*)>/gi, "**");
  text = text.replace(/<\/b>/gi, "**");
  text = text.replace(/<em([^>]*)>/gi, "*");
  text = text.replace(/<\/em>/gi, "*");
  text = text.replace(/<i([^>]*)>/gi, "*");
  text = text.replace(/<\/i>/gi, "*");

  text = text
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<\/h[1-6]>/gi, "\n\n")
    .replace(/<h[1-6][^>]*>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\*{4,}/g, "**")
    .replace(/\*{3,}/g, "**")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return text;
}

interface Course {
  id: string;
  title?: string;
  discipline?: string;
  grade?: string;
}

interface SearchResult {
  lesson_id: string;
  field_name: string;
  chunk_text: string;
  similarity: number;
  lesson_number?: number;
  lesson_title?: string;
  course_title?: string;
  course_id?: string;
  grade?: string;
}

interface EmbeddingSearchRow {
  lesson_id: string;
  field_name: string;
  chunk_text: string;
  similarity: number;
}

interface LessonCourseMap {
  courseId: string;
  courseTitle: string;
  grade: string;
}

interface LessonBasic {
  id: string;
  lesson_number: number;
  title: string;
  course_id: string;
  courses: {
    id: string;
    title: string;
    grade: string;
  } | null | unknown;
}

function filterCoursesByEnrollment(courses: Course[], enrollments: string[]): Course[] {
  if (enrollments.includes("ALL")) {
    return courses;
  }
  return courses.filter((course: Course) => {
    const courseKey = `${course.discipline?.toUpperCase()}_GRADE_${course.grade?.toUpperCase()}`;
    const disciplineOnly = course.discipline?.toUpperCase() || "";
    return enrollments.includes(courseKey) || enrollments.includes(disciplineOnly);
  });
}

type SearchScope = "lesson" | "course" | "global" | "ask";

type ScopePrefix = "curriculum" | "course" | "lesson" | null;

function detectScopePrefix(message: string): { scope: ScopePrefix; query: string } {
  const lower = message.toLowerCase().trim();

  if (lower.startsWith("curriculum:")) {
    return { scope: "curriculum", query: message.slice(11).trim() };
  }
  if (lower.startsWith("course:")) {
    return { scope: "course", query: message.slice(7).trim() };
  }
  if (lower.startsWith("lesson:")) {
    return { scope: "lesson", query: message.slice(7).trim() };
  }

  return { scope: null, query: message };
}

function detectSearchScope(message: string, pageLessonId: string | null, pageCourseId: string | null): SearchScope {
  const lower = message.toLowerCase();

  const curriculumQueryPatterns = [
    "how many", "instances of", "occurrences of", "count the",
    "where is", "where does", "where are", "find all", "search all",
    "search for", "look for", "show me all", "list all",
    "does this lesson", "does this course", "in this lesson", "in this course"
  ];

  const coursePatterns = [
    "this course", "the course", "in this course", "the entire course",
    "course-wide", "throughout the course", "across the course",
    "entire course", "whole course", "all lessons in this course",
    "summarize the course", "course overview", "all lessons in the course"
  ];
  const lessonPatterns = [
    "this lesson", "the lesson", "in this lesson", "the entire lesson",
    "throughout this lesson", "across this lesson"
  ];
  const globalPatterns = [
    "all my content", "all content", "everything", "all lessons",
    "search all", "find all", "search everything", "search all my",
    "all of my", "all of the", "my entire", "entire curriculum",
    "whole curriculum", "everywhere in", "across all", "not just this",
    "beyond this", "the entire", "my curriculum", "entire content",
    "all courses", "every lesson", "everywhere"
  ];

  const hasGlobal = globalPatterns.some(p => lower.includes(p));
  const hasCourse = coursePatterns.some(p => lower.includes(p));
  const hasLesson = lessonPatterns.some(p => lower.includes(p));
  const isCurriculumQuery = curriculumQueryPatterns.some(p => lower.includes(p));

  if (hasCourse) return "course";
  if (hasLesson) return "lesson";
  if (hasGlobal) return "global";

  if (pageLessonId) return "lesson";
  if (pageCourseId) return "course";

  if (isCurriculumQuery) return "global";

  return "ask";
}

function shouldReadContent(question: string): boolean {
  const lower = question.toLowerCase();
  const readPatterns = [
    "what does this", "what is this", "tell me about this",
    "what's in this", "what's covered", "what's included",
    "summarize this", "summary of", "what standards", "what elements",
    "analyze this", "review this", "describe this lesson"
  ];
  return readPatterns.some(p => lower.includes(p));
}

function isCourseListQuery(message: string): boolean {
  const lower = message.toLowerCase();
  const patterns = [
    "list my courses", "list courses", "show my courses", "show courses",
    "what courses", "my courses", "all my courses", "what courses do i have",
    "list all courses", "show me all courses", "all courses", "every course",
    "which courses", "courses i have", "courses do i", "get my courses"
  ];
  return patterns.some(p => lower.includes(p));
}

function isStandardQuery(message: string): boolean {
  const lower = message.toLowerCase();
  const hasAnchorStandard = /anchor standard \d+/i.test(message);
  const hasVapaStandard = /vapa standard/i.test(message);
  const hasNcasStandard = /ncas standard/i.test(message);
  return hasAnchorStandard || hasVapaStandard || hasNcasStandard;
}

type ModificationType = "duration" | "translation";

interface ModificationDetection {
  isModification: boolean;
  type: ModificationType | null;
  direction: "shorter" | "longer" | null;
  targetFields: string[] | null;
  targetLanguage: string | null;
}

const LANGUAGE_PATTERNS: Record<string, string[]> = {
  spanish: ["spanish", "español", "in spanish", "create a spanish", "make it spanish"],
  french: ["french", "in french", "create a french", "make it french", "français"],
  german: ["german", "in german", "create a german", "make it german", "deutsch"],
  portuguese: ["portuguese", "in portuguese", "create a portuguese"],
  chinese: ["chinese", "in chinese", "create a chinese", "mandarin"],
  japanese: ["japanese", "in japanese", "create a japanese"],
  korean: ["korean", "in korean", "create a korean"],
  vietnamese: ["vietnamese", "in vietnamese", "create a vietnamese"],
};

function extractTargetLanguage(message: string): string | null {
  const lower = message.toLowerCase();
  for (const [lang, patterns] of Object.entries(LANGUAGE_PATTERNS)) {
    if (patterns.some(p => lower.includes(p))) {
      return lang.charAt(0).toUpperCase() + lang.slice(1);
    }
  }
  return null;
}

const MODIFICATION_PATTERNS: Record<ModificationType, string[]> = {
  duration: [
    "shorter", "longer", "reduce", "expand", "condense", "more time",
    "less time", "cut down", "scale down", "scale up", "brief", "concise",
    "30 min", "45 min", "60 min", "20 minute", "30 minute", "40 minute",
    "30 minutes", "45 minutes", "60 minutes", "20 minutes", "40 minutes",
    "not enough time", "too long", "too short", "time constraint"
  ],
  translation: [
    "translate", "translation", "spanish version", "french version", "german version",
    "portuguese version", "chinese version", "japanese version", "korean version",
    "vietnamese version", "in spanish", "in french", "in german", "en español",
    "create a spanish", "make it french", "english translation", "bilingual"
  ]
};

const PROCEED_KEYWORDS = [
  "yes", "yeah", "yep", "sure", "ok", "okay", "do it",
  "go ahead", "proceed", "create it", "make it", "translate it",
  "yes please", "that sounds good", "perfect", "sounds good", "lets do it"
];

const NEGATIVE_KEYWORDS = [
  "no", "nope", "nah", "no thanks", "never mind", "cancel", "cancelled", "don't"
];

const DIRECTION_PATTERNS = {
  shorter: ["shorter", "reduce", "cut down", "condense", "brief", "scale down", "less", "not enough time", "too long", "instead of", "decrease", "min version", "cut to"],
  longer: ["longer", "expand", "more time", "scale up", "more", "too short", "add more", "increase", "max version"]
};

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

  const targetFields = lower.includes("all") || lower.includes("entire") || lower.includes("whole")
    ? null
    : null;

  const targetLanguage = detectedType === "translation" ? extractTargetLanguage(lower) : null;

  return {
    isModification: true,
    type: detectedType,
    direction,
    targetFields,
    targetLanguage
  };
}

function getModificationSystemPrompt(type: ModificationType, direction: "shorter" | "longer" | null, isEditingVersion: boolean): string {
  const baseInstructions: Record<ModificationType, string> = {
    duration: "The teacher wants to modify lesson length/duration.",
    translation: "The teacher wants to translate the lesson to another language."
  };

  let prompt = "You are an AI assistant helping a teacher modify lesson content.\n\n";
  prompt += "CRITICAL RULES:\n";
  prompt += "1. You MUST ACTUALLY MODIFY THE CONTENT. Do not just copy the original - make real changes.\n";
  prompt += "2. Return ONLY the fields that were ACTUALLY MODIFIED. Do NOT return all 15 fields - only return modified fields.\n";
  prompt += "3. Preserve all formatting and HTML structure in the modified fields\n";
  prompt += "4. Use EXACT field names from this list:\n";
  prompt += "   lessonOutline, learningObjectives, vocabulary, materials, vapaTextBlock, ncasTextBlock,\n";
  prompt += "   welcomeOpening, actualClassExpectations, warmUp, lessonHook, mainActivity,\n";
  prompt += "   instrumentExpectations, reflection, closingCeremony, assessment\n";
  prompt += "   Example: \"lessonOutline\": {\"html\": \"<table>...\"} NOT \"outline\": {\"html\": \"<table>...\"}\n";

  if (type === "duration") {
    prompt += "4. DURATION CHANGE: To change the lesson duration, you MUST follow this workflow:\n";
    prompt += "   - First, ask clarifying questions about how to modify (e.g., 'Should I remove activities, reduce repetitions, or shorten explanations?')\n";
    prompt += "   - Wait for the teacher's answers\n";
    prompt += "   - Then ask 'Should I proceed with these changes?' and wait for confirmation\n";
    prompt += "   - Only after teacher confirms, provide the modified JSON with changes\n";
    prompt += "   - For SHORTER: Remove activities entirely, reduce repetitions, shorten explanations\n";
    prompt += "   - For LONGER: Add more depth, expand explanations, add practice repetitions\n";
  } else {
    prompt += "4. Every field in modifiedFields MUST have an \"html\" property with the complete HTML content\n";
  }

  prompt += "5. CRITICAL JSON ESCAPING - FOLLOW THIS EXACTLY:\n";
  prompt += "   - In your JSON response, ALL double quotes inside HTML attribute values MUST be escaped as \\\"\n";
  prompt += "   - Example: <td style=\"width: 50%\"> must become <td style=\\\"width: 50%\\\">\n";
  prompt += "   - Example: class=\\\"cfu-left\\\" must stay as class=\\\"cfu-left\\\"\n";
  prompt += "   - If you do not escape these quotes, the JSON will be invalid and the request will fail\n";
  prompt += "6. IMPORTANT: This platform cannot receive files or images. Only ask for text-based explanations or clarifications.\n";
  prompt += "7. For FORMATTING ONLY requests (e.g., 'pull in formatting from original', 'apply formatting from another section'):\n";
  prompt += "   - Extract ONLY HTML ATTRIBUTES (styles, classes, data attributes, inline styles) from the reference\n";
  prompt += "   - Apply those attributes to the CURRENT content - Do NOT copy text content\n";
  prompt += "   - Return ONLY the field being formatted, not other fields\n";
  prompt += "8. For TEXT FORMATTING requests (e.g., 'make X bold', 'add italic', 'change color to red'):\n";
  prompt += "   - Return proper HTML tags: <strong>, <em>, <u>, <span style=\"color: red\">\n";
  prompt += "   - Tags must be properly opened and closed for valid HTML\n";

  if (type === "translation") {
    prompt += "\nTRANSLATION SPECIFIC RULES:\n";
    prompt += "9. IMPORTANT: For translations, you MUST return ALL 15 lesson content fields, not just modified ones.\n";
    prompt += "10. First, ask clarifying questions about the translation (e.g., target grade level, cultural adaptations, formality level).\n";
    prompt += "11. After getting answers, ask 'Should I proceed with the translation?' - wait for teacher to confirm before creating the version.\n";
    prompt += "12. When user confirms, translate ALL 15 fields to the requested language.\n";
    prompt += "13. Maintain HTML structure and formatting in the translated content.\n";
  } else if (isEditingVersion) {
    prompt += "9. EDITING EXISTING VERSION: The \"BASE LESSON\" section shows the ORIGINAL lesson content.\n";
  }

  prompt += baseInstructions[type];

  return prompt;
}

function repairJSON(jsonString: string): string | null {
  // Strategy: Only escape quotes that appear INSIDE HTML attribute values
  // HTML attributes look like: attribute="value" where value might contain quotes
  // We need to find these patterns and escape only the quotes inside the attribute values
  
  // Pattern to match HTML attribute values that might contain unescaped quotes
  // This regex finds attribute="value" patterns where value contains quotes
  const attrPattern = /(\w+(?:-\w+)*)="([^"\\]*(?:\\.[^"\\]*)*)"/g;
  
  let fixed = jsonString;
  let match;
  let modified = false;
  
  // Find all attribute="value" patterns and escape any quotes within the value
  while ((match = attrPattern.exec(jsonString)) !== null) {
    const attrName = match[1];
    const attrValue = match[2];
    const fullMatch = match[0];
    
    // If the attribute value contains an unescaped quote, we need to escape it
    // Check if there are any quotes that would break JSON
    if (attrValue.includes('"')) {
      // The value has quotes that need escaping
      const escapedValue = attrValue.replace(/"/g, '\\"');
      const escapedFullMatch = `${attrName}="${escapedValue}"`;
      fixed = fixed.replace(fullMatch, escapedFullMatch);
      modified = true;
    }
  }
  
  if (!modified) {
    return null; // No HTML attribute quotes to fix
  }
  
  try {
    JSON.parse(fixed);
    return fixed;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { message, conversationHistory, lessonId, courseId, scope, searchQuery: explicitQuery, page = 0, pageSize = 10, editingVersionId, waitingForConfirmation, context, versionMode } = body;
    let explicitScope = scope;

    if (!message) {
      return NextResponse.json({ error: "Missing message" }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const { data: profile } = await supabase
      .from("profiles")
      .select("enrollments")
      .eq("id", userId)
      .single();

    const enrollments = profile?.enrollments || [];

    let effectiveScope: SearchScope;
    if (explicitScope && ["lesson", "course", "global"].includes(explicitScope)) {
      effectiveScope = explicitScope;
    } else {
      effectiveScope = detectSearchScope(message, lessonId, courseId);
    }

    const { scope: prefixScope, query: prefixQuery } = detectScopePrefix(message);
    let processedMessage = message;
    if (prefixScope) {
      processedMessage = prefixQuery;
      effectiveScope = "ask";
      explicitScope = null;
    }

    const wantsContentSearch = explicitScope ? true : (shouldReadContent(message) || effectiveScope !== "ask");

    let searchResults: SearchResult[] = [];
    let aiResponse = "";
    let curriculumContext = "";
    let links: { label: string; url: string }[] = [];

    if (effectiveScope === "ask" && !explicitScope) {
      const systemPrompt = `TOOL USE REQUIRED: When asked to find/search/list lessons or courses, you MUST use the search_lessons tool. Do NOT say you cannot access curriculum.

You are a helpful AI assistant for music, dance, and theatre education.
You help teachers with questions about VAPA standards, NCAS standards, curriculum design, pedagogy, lesson planning, and general music/dance/theatre education topics.

CRITICAL: You have access to tools to search the teacher's curriculum. You MUST use these tools when answering questions about lessons, courses, or curriculum content:
- search_lessons: Search all lessons for a topic/keyword (use this when user asks to find lessons)
- get_lesson_details: Get full content of a specific lesson
- list_my_courses: List all courses the teacher has access to

When the user asks to find, locate, search for, or list lessons or courses, you MUST call the appropriate tool. Do NOT say you cannot access lesson content - use the tools to search and provide results.

Be concise and helpful in your responses.
IMPORTANT: This platform cannot receive files or images. Only ask for text-based explanations or clarifications. Never request screenshots, files, or visual examples.`;

      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (apiKey) {
        const messages = conversationHistory
          ? [...conversationHistory.map((m: { role: string; content: string }) => ({ role: m.role, content: m.content })), { role: "user" as const, content: processedMessage }]
          : [{ role: "user" as const, content: processedMessage }];

        let toolResponse = await fetch(ANTHROPIC_API_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: MODEL,
            max_tokens: MAX_TOKENS,
            tools: TOOLS,
            tool_choice: { type: "any" },
            system: systemPrompt,
            messages,
          }),
        });

        let toolResult = await toolResponse.json();

        while (toolResult.stop_reason === "tool_use") {
          const toolUses = toolResult.content.filter((c: { type: string }) => c.type === "tool_use");

          for (const toolUse of toolUses) {
            const toolName = toolUse.name;
            const toolInput = toolUse.input;

            let result: unknown;
            try {
              if (toolName === "search_lessons") {
                result = await searchLessons({
                  query: toolInput.query,
                  grade: toolInput.grade,
                  courseId: toolInput.course_id,
                  discipline: toolInput.discipline,
                  maxResults: toolInput.max_results || 10,
                  userId,
                });
              } else if (toolName === "get_lesson_details") {
                result = await getLessonDetails({
                  lesson_id: toolInput.lesson_id,
                  sections: toolInput.sections,
                });
              } else if (toolName === "list_my_courses") {
                result = await listMyCourses(userId);
              } else {
                result = { error: `Unknown tool: ${toolName}` };
              }
            } catch (err) {
              console.error(`Tool ${toolName} error:`, err);
              result = { error: String(err) };
            }

              messages.push({
              role: "assistant",
              content: toolResult.content
            });
            messages.push({
              role: "user",
              content: [{ type: "tool_result", tool_use_id: toolUse.id, content: JSON.stringify(result) }]
            });
          }

          toolResponse = await fetch(ANTHROPIC_API_URL, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": apiKey,
              "anthropic-version": "2023-06-01",
            },
            body: JSON.stringify({
              model: MODEL,
              max_tokens: MAX_TOKENS,
              tools: TOOLS,
              system: systemPrompt,
              messages,
            }),
          });

          toolResult = await toolResponse.json();
        }

        aiResponse = toolResult.content?.[0]?.text || "";
        links = extractLinks(aiResponse);
      } else {
        aiResponse = "AI is not configured. Please contact an administrator.";
      }
    }

    if (isCourseListQuery(message)) {
      const { data: allCourses } = await supabase
        .from("courses")
        .select("id, title, discipline, grade")
        .order("discipline")
        .order("grade");

      const filteredCourses = filterCoursesByEnrollment(
        (allCourses || []) as Course[],
        enrollments
      );

      if (filteredCourses.length === 0) {
        return NextResponse.json({
          response: "You don't have access to any courses yet. Please contact an administrator.",
          links: [],
          results: [],
        });
      }

      const grouped = new Map<string, typeof filteredCourses>();
      for (const course of filteredCourses) {
        const key = `${course.discipline}-${course.grade}`;
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key)!.push(course);
      }

      const lines: string[] = [`You have access to ${filteredCourses.length} course${filteredCourses.length !== 1 ? 's' : ''}:\n`];
      for (const [key, courses] of grouped) {
        const [discipline, grade] = key.split('-');
        lines.push(`\n**${discipline} - Grade ${grade}**`);
        for (const course of courses) {
          lines.push(`- ${course.title}`);
        }
      }

      return NextResponse.json({
        response: lines.join("\n"),
        links: [],
        results: [],
      });
    }

    if (isStandardQuery(message)) {
      const standardSearchTerms: string[] = [];

      const anchorStandardMatch = message.match(/anchor standard\s*(\d+)/i);
      if (anchorStandardMatch) {
        const num = anchorStandardMatch[1];
        standardSearchTerms.push(`Anchor Standard ${num}`);
      }

      if (standardSearchTerms.length === 0) {
        const cleanTerm = message.replace(/^(which|find|show|list)\s*(me\s*)?(all\s*)?(lessons?\s*)?(that|which|where)?\s*/i, '').trim();
        if (cleanTerm && cleanTerm.length > 3) {
          standardSearchTerms.push(cleanTerm);
        }
      }

      if (standardSearchTerms.length === 0) {
        return NextResponse.json({
          response: "I couldn't determine what standard you're looking for. Please specify like 'Anchor Standard 4' or 'which lessons deal with Anchor Standard 7'.",
          links: [],
          results: [],
        });
      }

      const { data: allCourses } = await supabase
        .from("courses")
        .select("id, title, discipline, grade");

      const filteredCourseIds = filterCoursesByEnrollment(
        (allCourses || []) as Course[],
        enrollments
      ).map((c: Course) => c.id);

      if (filteredCourseIds.length === 0) {
        return NextResponse.json({
          response: "You don't have access to any courses yet.",
          links: [],
          results: [],
        });
      }

      const { data: lessons } = await supabase
        .from("lessons")
        .select("id, lesson_number, title, course_id, courses(id, title, discipline, grade), vapa_text_block, ncas_text_block")
        .in("course_id", filteredCourseIds);

      if (!lessons || lessons.length === 0) {
        return NextResponse.json({
          response: "No lessons found.",
          links: [],
          results: [],
        });
      }

      const standardResults: SearchResult[] = [];

      for (const lesson of lessons) {
        const lessonAny = lesson as Record<string, unknown>;
        const course = lessonAny.courses as { title?: string; grade?: string } | null;
        const vapaText = (lessonAny.vapa_text_block as string) || "";
        const ncasText = (lessonAny.ncas_text_block as string) || "";

        for (const term of standardSearchTerms) {
          const termLower = term.toLowerCase();

          if (vapaText.toLowerCase().includes(termLower)) {
            const snippet = generateSnippet(vapaText, term);
            standardResults.push({
              lesson_id: lessonAny.id as string,
              field_name: "vapa_text_block",
              chunk_text: snippet,
              similarity: 1,
              lesson_number: lessonAny.lesson_number as number,
              lesson_title: lessonAny.title as string,
              course_title: course?.title || "Unknown",
              course_id: lessonAny.course_id as string,
              grade: course?.grade || "",
            });
          }

          if (ncasText.toLowerCase().includes(termLower)) {
            const snippet = generateSnippet(ncasText, term);
            standardResults.push({
              lesson_id: lessonAny.id as string,
              field_name: "ncas_text_block",
              chunk_text: snippet,
              similarity: 1,
              lesson_number: lessonAny.lesson_number as number,
              lesson_title: lessonAny.title as string,
              course_title: course?.title || "Unknown",
              course_id: lessonAny.course_id as string,
              grade: course?.grade || "",
            });
          }
        }
      }

      if (standardResults.length === 0) {
        return NextResponse.json({
          response: `I searched for ${standardSearchTerms.join(", ")} but didn't find any lessons that mention these standards. Try using the Search Content tab to search for a specific term.`,
          links: [],
          results: [],
        });
      }

      const uniqueLessons = new Set(standardResults.map(r => `${r.course_id}-${r.lesson_id}`)).size;
      const totalResults = standardResults.length;
      const paginatedResults = standardResults.slice(page * pageSize, (page + 1) * pageSize);
      const hasMore = (page + 1) * pageSize < totalResults;

      return NextResponse.json({
        response: `Found ${totalResults} references to ${standardSearchTerms.join(", ")} across ${uniqueLessons} lesson${uniqueLessons !== 1 ? 's' : ''}. Showing ${paginatedResults.length} results.`,
        links: [],
        results: paginatedResults,
        totalResults,
        hasMore,
        directResults: formatDirectResults(paginatedResults),
      });
    }

    // Second AI tool use block removed (duplicate) - keeping only the first one at line 529

    if (wantsContentSearch) {
      if (enrollments.length === 0) {
        return NextResponse.json({
          response: "You don't have access to any courses yet. Please contact an administrator.",
          links: [],
          results: [],
        });
      }

      const { data: allCourses } = await supabase
        .from("courses")
        .select("id, title, discipline, grade");

      const filteredCourseIds = filterCoursesByEnrollment(
        (allCourses || []) as Course[],
        enrollments
      ).map((c: Course) => c.id);

      if (filteredCourseIds.length > 0) {
        const cleanQuery = (explicitQuery || message).trim();

        if (cleanQuery.length < 2) {
          return NextResponse.json({
            response: "Please provide a search term or question.",
            links: [],
            results: [],
          });
        }

        let lessonsQuery = supabase
          .from("lessons")
          .select("id, lesson_number, title, course_id, courses(id, title, discipline, grade), " + TEXT_FIELDS_LIST.join(", "));

        if (effectiveScope === "lesson") {
          if (!lessonId) {
            return NextResponse.json({
              response: "To search within a lesson, please open that lesson first, then run your search.",
              links: [],
              results: [],
            });
          }
          lessonsQuery = lessonsQuery.eq("id", lessonId);
        } else if (effectiveScope === "course") {
          if (!courseId) {
            return NextResponse.json({
              response: "To search within a course, please select a course from the dropdown first.",
              links: [],
              results: [],
            });
          }
          lessonsQuery = lessonsQuery.eq("course_id", courseId);
        } else {
          lessonsQuery = lessonsQuery.in("course_id", filteredCourseIds);
        }

        const { data: lessons, error: lessonsError } = await lessonsQuery;

        if (lessonsError) {
          console.error("Lessons query error:", lessonsError);
          return NextResponse.json({
            response: "Search encountered an error. Please try again.",
            links: [],
            results: [],
          });
        }

        if (!lessons || lessons.length === 0) {
          return NextResponse.json({
            response: "No lessons found matching your search.",
            links: [],
            results: [],
          });
        }

        const matchesMap = new Map<string, SearchResult>();

        for (const lesson of lessons) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const lessonAny = lesson as any;
          const course = lessonAny.courses;
          const lessonIdStr = lessonAny.id;
          const courseIdStr = lessonAny.course_id;

          for (const fieldName of TEXT_FIELDS_LIST) {
            const fieldValue = lessonAny[fieldName];
            if (!fieldValue || typeof fieldValue !== "string") continue;

            const matches = findMatchesInContent(fieldValue, cleanQuery, fieldName, false);
            if (!matches || matches.matches.length === 0) continue;

            const snippet = generateSnippet(fieldValue, cleanQuery);
            const key = `${lessonIdStr}-${fieldName}`;

            if (!matchesMap.has(key)) {
              matchesMap.set(key, {
                lesson_id: lessonIdStr,
                field_name: fieldName,
                chunk_text: snippet,
                similarity: 1,
                lesson_number: lessonAny.lesson_number,
                lesson_title: lessonAny.title,
                course_title: course?.title || "Unknown Course",
                course_id: courseIdStr,
                grade: course?.grade || "",
              });
            }
          }
        }

        searchResults = Array.from(matchesMap.values());
        curriculumContext = buildKeywordSearchContext(searchResults);
      }
    }

    let fullLessonContent = "";
    let modificationLessonContent = "";
    let currentLessonInfo = "";
    let currentCourseInfo = "";
    let courseLessons: { id: string; lesson_number: number; title: string }[] = [];

    if (effectiveScope === "course" && courseId) {
      const { data: courseData } = await supabase
        .from("courses")
        .select("id, title, discipline, grade, summary")
        .eq("id", courseId)
        .single();

      const { data: lessonsData } = await supabase
        .from("lessons")
        .select("id, lesson_number, title")
        .eq("course_id", courseId)
        .order("lesson_number");

      if (courseData) {
        currentCourseInfo = `Current course context: "${courseData.title}" (${courseData.discipline}, Grade ${courseData.grade}). Summary: ${courseData.summary || "No summary available."}`;
        courseLessons = lessonsData || [];
      }

      const lowerMessage = message.toLowerCase();
      const wantsCourseSummary = lowerMessage.includes("summarize") ||
        lowerMessage.includes("overview") ||
        lowerMessage.includes("what's covered") ||
        lowerMessage.includes("what is covered") ||
        lowerMessage.includes("whole course") ||
        lowerMessage.includes("entire course") ||
        lowerMessage.includes("all about");

      if (wantsCourseSummary && courseLessons.length > 0) {
        const { data: fullLessons } = await supabase
          .from("lessons")
          .select("id, lesson_number, title, lesson_outline, main_activity, learning_objectives")
          .eq("course_id", courseId)
          .order("lesson_number");

        if (fullLessons && fullLessons.length > 0) {
          const lessonSummaries = fullLessons.map((l: Record<string, unknown>) => {
            const outline = (l.lesson_outline as string)?.replace(/<[^>]*>/g, '').substring(0, 200) || "(no outline)";
            const activity = (l.main_activity as string)?.replace(/<[^>]*>/g, '').substring(0, 200) || "(no activity description)";
            const objectives = (l.learning_objectives as string)?.replace(/<[^>]*>/g, '').substring(0, 200) || "(no objectives)";
            return `Lesson ${l.lesson_number}: ${l.title}\n  Overview: ${outline}...\n  Activity: ${activity}...\n  Objectives: ${objectives}...`;
          }).join("\n\n");

          currentCourseInfo += `\n\nHere is content from all lessons in this course:\n\n${lessonSummaries}`;
        }
      }
    }

    let editingVersionContent: Record<string, { html: string }> | null = null;

    if (effectiveScope === "lesson" && lessonId) {
      const { data: fullLesson } = await supabase
        .from("lessons")
        .select("id, title, lesson_number, course_id, courses(id, title, grade), lesson_outline, learning_objectives, vocabulary, materials, vapa_text_block, ncas_text_block, welcome_opening, actual_class_expectations, warm_up, lesson_hook, main_activity, instrument_expectations, reflection, closing_ceremony, assessment")
        .eq("id", lessonId)
        .single();

      if (fullLesson) {
        const lessonWithCourse = fullLesson as unknown as LessonBasic;
        const courseData = lessonWithCourse.courses as { id?: string; title?: string; grade?: string } | null;
        const course = Array.isArray(courseData) ? courseData[0] : courseData;

        if (editingVersionId) {
          console.log("[MODIFICATION] Fetching version data for:", editingVersionId);
          const { data: versionData } = await supabase
            .from("lesson_versions")
            .select("content, version_name")
            .eq("id", editingVersionId)
            .single();
          console.log("[MODIFICATION] Version data fetched:", !!versionData, "content keys:", versionData?.content ? Object.keys(versionData.content).length : 0);
          if (versionData?.content) {
            editingVersionContent = versionData.content as Record<string, { html: string }>;
            console.log("[MODIFICATION] Version content fields:", Object.keys(editingVersionContent));
          }
        }

        const lessonTitle = fullLesson.title;
        const lessonNumber = fullLesson.lesson_number;
        const courseTitle = course?.title || "Unknown";
        const courseGrade = course?.grade || "Unknown";

        currentLessonInfo = `Current lesson context: "${lessonTitle}" (Course: ${courseTitle}, Grade: ${courseGrade}, Lesson #: ${lessonNumber})`;
        fullLessonContent = `FULL CONTENT OF THIS LESSON:

Lesson: ${fullLesson.title}
Course: ${course?.title || "Unknown"}
Grade: ${course?.grade || "Unknown"}
Lesson Number: ${fullLesson.lesson_number}

--- LESSON OUTLINE ---
${fullLesson.lesson_outline || "(empty)"}

--- LEARNING OBJECTIVES ---
${fullLesson.learning_objectives || "(empty)"}

--- VOCABULARY ---
${fullLesson.vocabulary || "(empty)"}

--- MATERIALS ---
${fullLesson.materials || "(empty)"}

--- VAPA STANDARDS ---
${fullLesson.vapa_text_block || "(empty)"}

--- NCAS STANDARDS ---
${fullLesson.ncas_text_block || "(empty)"}

--- WELCOME AND OPENING CHECK-IN ---
${fullLesson.welcome_opening || "(empty)"}

--- CLASS EXPECTATIONS AND PROCEDURES ---
${fullLesson.actual_class_expectations || "(empty)"}

--- WARM UP ---
${fullLesson.warm_up || "(empty)"}

--- LESSON HOOK ---
${fullLesson.lesson_hook || "(empty)"}

--- MAIN ACTIVITY ---
${fullLesson.main_activity || "(empty)"}

--- INSTRUMENT EXPECTATIONS ---
${fullLesson.instrument_expectations || "(empty)"}

--- REFLECTION ---
${fullLesson.reflection || "(empty)"}

--- CLOSING CEREMONY ---
${fullLesson.closing_ceremony || "(empty)"}

--- ASSESSMENT ---
${fullLesson.assessment || "(empty)"}
`;
        modificationLessonContent = `FULL CONTENT OF THIS LESSON:

Lesson: ${lessonTitle}
Course: ${courseTitle}
Grade: ${courseGrade}
Lesson Number: ${lessonNumber}

--- LESSON OUTLINE ---
${editingVersionContent?.lesson_outline?.html || fullLesson.lesson_outline || "(empty)"}

--- WELCOME AND OPENING CHECK-IN ---
${editingVersionContent?.welcome_opening?.html || fullLesson.welcome_opening || "(empty)"}

--- CLASS EXPECTATIONS AND PROCEDURES ---
${editingVersionContent?.actual_class_expectations?.html || fullLesson.actual_class_expectations || "(empty)"}

--- WARM UP ---
${editingVersionContent?.warm_up?.html || fullLesson.warm_up || "(empty)"}

--- LESSON HOOK ---
${editingVersionContent?.lesson_hook?.html || fullLesson.lesson_hook || "(empty)"}

--- MAIN ACTIVITY ---
${editingVersionContent?.main_activity?.html || fullLesson.main_activity || "(empty)"}

--- REFLECTION ---
${editingVersionContent?.reflection?.html || fullLesson.reflection || "(empty)"}

--- CLOSING CEREMONY ---
${editingVersionContent?.closing_ceremony?.html || fullLesson.closing_ceremony || "(empty)"}
${editingVersionId ? `

================================================================================
BASE LESSON (original) - This is the original lesson content BEFORE modifications.
Use this as reference if the user asks to "revert", "restore original", or compare.
================================================================================

--- BASE LESSON OUTLINE ---
${fullLesson.lesson_outline || "(empty)"}

--- BASE LESSON WELCOME AND OPENING CHECK-IN ---
${fullLesson.welcome_opening || "(empty)"}

--- BASE LESSON CLASS EXPECTATIONS AND PROCEDURES ---
${fullLesson.actual_class_expectations || "(empty)"}

--- BASE LESSON WARM UP ---
${fullLesson.warm_up || "(empty)"}

--- BASE LESSON LESSON HOOK ---
${fullLesson.lesson_hook || "(empty)"}

--- BASE LESSON MAIN ACTIVITY ---
${fullLesson.main_activity || "(empty)"}

--- BASE LESSON REFLECTION ---
${fullLesson.reflection || "(empty)"}

--- BASE LESSON CLOSING CEREMONY ---
${fullLesson.closing_ceremony || "(empty)"}` : ''}
`;
      }
    }

    const hasCurriculumResults = searchResults.length > 0;
    const directResults = hasCurriculumResults ? formatDirectResults(searchResults) : "";
    const modificationDetection = detectModificationRequest(message);

    links = [];
    let modificationPreview: Record<string, unknown> | null = null;
    let needsConfirmation = false;

    const isEditingVersionFlow = editingVersionId && modificationLessonContent;
    const userSaidProceed = PROCEED_KEYWORDS.some(k => message.toLowerCase().includes(k));
    const userSaidNo = NEGATIVE_KEYWORDS.some(k => message.toLowerCase().includes(k));

    const isVersionMode = context === "versions" && versionMode;

    if (effectiveScope === "lesson" && lessonId && (isVersionMode || modificationDetection.isModification || isEditingVersionFlow || waitingForConfirmation) && modificationLessonContent) {
      console.log("[MODIFICATION] Condition matched:", {
        effectiveScope,
        lessonId,
        isVersionMode,
        isModification: modificationDetection.isModification,
        isEditingVersionFlow,
        waitingForConfirmation,
        hasContent: !!modificationLessonContent,
        type: modificationDetection.type,
        userSaidProceed
      });

      let modType: string | null = modificationDetection.type || "materials";
      const modDirection = modificationDetection.direction;
      let targetLanguage = modificationDetection.targetLanguage;

      // If waitingForConfirmation is true, we should have stored the language
      // Extract from conversation history if needed
      if (waitingForConfirmation && !targetLanguage && conversationHistory && conversationHistory.length > 0) {
        const allContent = conversationHistory.map((m: { content: string }) => m.content).join(" ");
        targetLanguage = extractTargetLanguage(allContent.toLowerCase());
      }

      // Only process modification requests for duration and translation
      if (isVersionMode && modType && !["duration", "translation"].includes(modType)) {
        modType = null;
      }

      // If waitingForConfirmation, ensure modType is either duration or translation (it should already be set)
      if (waitingForConfirmation && modType && !["duration", "translation"].includes(modType)) {
        modType = null;
      }

      console.log("[MODIFICATION] modType after translation check:", modType);

      const isFreshTranslationRequest = modType === "translation" && !waitingForConfirmation;

      if (isFreshTranslationRequest) {
        const gradeMatch = modificationLessonContent.match(/Grade:\s*([^\n]+)/);
        const grade = gradeMatch ? gradeMatch[1].trim() : "the lesson's grade level";
        const formattedGrade = grade.match(/^\d+$/) ? `Grade ${grade}` : grade;
        const lang = targetLanguage || "Spanish";

        const systemPrompt = `You are helping prepare a lesson for ${lang} translation. This is a ${formattedGrade} music lesson.

Analyze the lesson content below and:

1. Identify any elements that don't translate directly to ${lang}:
   - Songs, chants, or rhymes
   - Tongue twisters
   - Rhyming activities
   - Cultural references specific to English
   - Wordplay or puns
   - Musical terms that may not have direct ${lang} equivalents

2. Explain what you found in a conversational way - be honest about limitations but helpful

3. Ask the teacher:
   - What tone they prefer (formal or informal)
   - Any cultural considerations or adaptations they want you to keep in mind
   - Whether there are specific sections they're most concerned about

Be conversational, helpful, and honest. Don't just ask yes/no questions - engage with the content and show the teacher you actually looked at what they're working with.`;

        const userMessage = `Please analyze this lesson for ${lang} translation and tell me what you find:

${modificationLessonContent}`;

        const apiKey = process.env.ANTHROPIC_API_KEY;
        if (!apiKey) {
          return NextResponse.json({
            response: "AI is not configured. Please contact an administrator.",
            links: [],
            results: [],
            isModificationRequest: true,
            needsConfirmation: true,
            modificationType: "translation",
            modificationPreview: null,
            editingVersionId: editingVersionId || null,
          });
        }

        const messages = conversationHistory
          ? [...conversationHistory, { role: "user", content: userMessage }]
          : [{ role: "user", content: userMessage }];

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
        } catch {
          return NextResponse.json({
            response: "Network error. Please try again.",
            links: [],
            results: [],
            isModificationRequest: true,
            needsConfirmation: true,
            modificationType: "translation",
            modificationPreview: null,
            editingVersionId: editingVersionId || null,
          });
        }

        if (!response.ok) {
          return NextResponse.json({
            response: "AI encountered an error. Please try again.",
            links: [],
            results: [],
            isModificationRequest: true,
            needsConfirmation: true,
            modificationType: "translation",
            modificationPreview: null,
            editingVersionId: editingVersionId || null,
          });
        }

        const result = await response.json();
        const aiResponseText = result.content?.[0]?.text || "";

        return NextResponse.json({
          response: aiResponseText,
          links: [],
          results: [],
          isModificationRequest: true,
          needsConfirmation: true,
          modificationType: "translation",
          modificationPreview: null,
          editingVersionId: editingVersionId || null,
        });
      }

      if (modType === "translation" && waitingForConfirmation && !userSaidProceed) {
        const messageWords = message.trim().split(/\s+/).length;
        const isBriefNo = userSaidNo && messageWords <= 2;
        const lang = targetLanguage || "Spanish";

        if (isBriefNo) {
          return NextResponse.json({
            response: `OK, I've cancelled the ${lang} translation. Let me know if you'd like to try again or need something else!`,
            links: [],
            results: [],
            isModificationRequest: false,
            needsConfirmation: false,
            modificationType: null,
            modificationPreview: null,
            editingVersionId: null,
          });
        }

        const systemPrompt = `You are a helpful teaching assistant helping translate a lesson to ${lang}.

The teacher is asking questions about your proposed translation approach or has provided additional context.
Please:
1. Directly answer their question about the translation
2. Acknowledge any specific context they provided (grade level input, cultural notes, tone preferences, etc.)
3. Then ask "Should I proceed with creating the ${lang} translation? (Please answer yes or no to confirm)"

Keep your response conversational and helpful.`;

        const userMessage = `The teacher said: "${message}"

Please answer their question and confirm if they want to proceed with the translation.`;

        const apiKey = process.env.ANTHROPIC_API_KEY;
        if (!apiKey) {
          return NextResponse.json({
            response: "AI is not configured. Please contact an administrator.",
            links: [],
            results: [],
            isModificationRequest: true,
            needsConfirmation: true,
            modificationType: "translation",
            modificationPreview: null,
            editingVersionId: editingVersionId || null,
          });
        }

        const messages = conversationHistory
          ? [...conversationHistory, { role: "user", content: userMessage }]
          : [{ role: "user", content: userMessage }];

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
        } catch {
          return NextResponse.json({
            response: "Network error. Please try again.",
            links: [],
            results: [],
            isModificationRequest: true,
            needsConfirmation: true,
            modificationType: "translation",
            modificationPreview: null,
            editingVersionId: editingVersionId || null,
          });
        }

        if (!response.ok) {
          return NextResponse.json({
            response: "AI encountered an error. Please try again.",
            links: [],
            results: [],
            isModificationRequest: true,
            needsConfirmation: true,
            modificationType: "translation",
            modificationPreview: null,
            editingVersionId: editingVersionId || null,
          });
        }

        const result = await response.json();
        const aiResponseText = result.content?.[0]?.text || "Should I proceed with creating the Spanish translation?";

        return NextResponse.json({
          response: aiResponseText,
          links: [],
          results: [],
          isModificationRequest: true,
          needsConfirmation: true,
          modificationType: "translation",
          modificationPreview: null,
          editingVersionId: editingVersionId || null,
        });
      }

      if (modType === "translation" && waitingForConfirmation && userSaidProceed) {
        const lang = targetLanguage || "Spanish";
        const userPrefs = conversationHistory && conversationHistory.length > 0
          ? `\nThe teacher previously indicated:\n${conversationHistory.map((m: { role: string; content: string }) => `${m.role}: ${m.content}`).join('\n')}`
          : "";

        const translateSystemPrompt = `You are an AI assistant helping a teacher translate lesson content to ${lang}.

CRITICAL FORMATTING PRESERVATION:
1. You are translating TEXT CONTENT only - NEVER modify HTML tags, attributes, or structure
2. Preserve ALL original HTML tags exactly: <p>, <h3>, <ul>, <li>, <strong>, <em>, <table>, <colgroup>, <col>, <tr>, <td>, <th>, <div>, <span>, <a>, <br>, etc.
3. Preserve ALL HTML attributes exactly as they appear:
   - Table attributes: data-width, data-alignment, data-column-widths, data-show-grid, style (width, margin-left, margin-right, etc.)
   - CFU attributes: data-cfu-id, data-background-image, data-png-image, data-alignment, data-check-for-understanding, class, style
   - Link attributes: target, rel, class (section-link, resource-link, youtube-link, etc.)
4. For tables: Keep ALL <colgroup>, <col>, <thead>, <tbody>, <tr>, <th>, <td> structure intact
5. For CFU blocks: Keep the complete div>table>tr>td structure with all attributes
6. Keep ALL inline styles: margin-left, padding, font-weight, color, etc.
7. Keep ALL data-* attributes and class names exactly as they appear

You MUST return ONLY a JSON object with the following structure - NO TEXT BEFORE OR AFTER:
{
  "modifiedFields": {
    "lesson_outline": { "html": "<p>Translated content here</p>" },
    "learning_objectives": { "html": "<p>Translated content here</p>" },
    "vocabulary": { "html": "<p>Translated content here</p>" },
    "materials": { "html": "<p>Translated content here</p>" },
    "vapa_text_block": { "html": "<p>Translated content here</p>" },
    "ncas_text_block": { "html": "<p>Translated content here</p>" },
    "welcome_opening": { "html": "<p>Translated content here</p>" },
    "actual_class_expectations": { "html": "<p>Translated content here</p>" },
    "warm_up": { "html": "<p>Translated content here</p>" },
    "lesson_hook": { "html": "<p>Translated content here</p>" },
    "main_activity": { "html": "<p>Translated content here</p>" },
    "instrument_expectations": { "html": "<p>Translated content here</p>" },
    "reflection": { "html": "<p>Translated content here</p>" },
    "closing_ceremony": { "html": "<p>Translated content here</p>" },
    "assessment": { "html": "<p>Translated content here</p>" }
  },
  "summary": "Brief description of what was translated",
  "suggestedVersionName": "${lang} Translation - ${new Date().toLocaleDateString()}"
}

CRITICAL RULES:
1. Return ONLY the JSON object - no explanatory text before or after
2. You MUST return ALL 15 lesson content fields with translated HTML content
3. Translate the TEXT CONTENT between tags - keep all tags and attributes exactly as they are
4. Preserve the complete HTML structure of the original lesson
5. Keep the grade-level vocabulary appropriate for the students
6. For songs/chants, ADAPT the rhyme scheme to work in ${lang} - do not keep English rhymes
7. Escape all double quotes as \\\" and single quotes as \\\' in HTML content
8. Each field's html must contain the COMPLETE translated content
9. Do NOT ask questions - only return the JSON${userPrefs}`;

        const apiKey = process.env.ANTHROPIC_API_KEY;
        if (!apiKey) {
          return NextResponse.json({
            response: "AI is not configured. Please contact an administrator.",
            links: [],
            results: [],
            isModificationRequest: true,
            needsConfirmation: false,
            modificationPreview: null,
            editingVersionId: editingVersionId || null,
          });
        }

        // Keep the HTML structure intact for translation
        let translateLessonContent = modificationLessonContent;
        const baseLessonIndex = translateLessonContent.indexOf("BASE LESSON");
        if (baseLessonIndex !== -1) {
          translateLessonContent = translateLessonContent.substring(0, baseLessonIndex);
        }

        const translateMessages = [
          { role: "user", content: `Translate this lesson to ${lang}.

CRITICAL FORMATTING RULES:
1. Preserve ALL HTML tags, attributes, and structure exactly as they appear
2. For tables: Keep data-width, data-alignment, data-column-widths, style attributes, and colgroup elements
3. For CFU blocks: Keep data-cfu-id, data-background-image, data-png-image, data-alignment, and all style attributes
4. Translate the TEXT CONTENT only - never change tag names, attribute values, or structure
5. Return COMPLETE HTML for each field - do not truncate or omit any content

Return ONLY a JSON object with keys: lesson_outline, learning_objectives, vocabulary, materials, vapa_text_block, ncas_text_block, welcome_opening, actual_class_expectations, warm_up, lesson_hook, main_activity, instrument_expectations, reflection, closing_ceremony, assessment. Each value should be the complete translated HTML content.

${translateLessonContent}` }
        ];

        let translateResponse;
        try {
          translateResponse = await fetch(ANTHROPIC_API_URL, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": apiKey,
              "anthropic-version": "2023-06-01",
            },
            body: JSON.stringify({
              model: MODIFICATION_MODEL,
              max_tokens: 8192,
              system: translateSystemPrompt,
              messages: translateMessages.map((m: { role: string; content: string }) => ({
                role: m.role,
                content: m.content,
              })),
            }),
          });
        } catch {
          return NextResponse.json({
            response: "Network error. Please try again.",
            links: [],
            results: [],
            isModificationRequest: true,
            needsConfirmation: true,
            modificationPreview: null,
            editingVersionId: editingVersionId || null,
          });
        }

        if (!translateResponse.ok) {
          return NextResponse.json({
            response: "AI encountered an error. Please try again.",
            links: [],
            results: [],
            isModificationRequest: true,
            needsConfirmation: true,
            modificationPreview: null,
            editingVersionId: editingVersionId || null,
          });
        }

        const translateResult = await translateResponse.json();
        const rawResponse = translateResult.content?.[0]?.text || "";

        let modificationPreview: Record<string, unknown> | null = null;
        try {
          const jsonMatch = rawResponse.match(/```json\n?([\s\S]*?)\n?```|(\{[\s\S]*?\})/);
          if (jsonMatch) {
            let jsonString = jsonMatch[1] || jsonMatch[2];
            try {
              modificationPreview = JSON.parse(jsonString);
              console.log("[TRANSLATION] Parsed modificationPreview keys:", modificationPreview ? Object.keys(modificationPreview) : "null");
            } catch {
              const repaired = repairJSON(jsonString);
              if (repaired) {
                try {
                  modificationPreview = JSON.parse(repaired);
                  console.log("[TRANSLATION] Successfully parsed repaired JSON");
                } catch {
                  console.log("[TRANSLATION] Repair failed");
                }
              }
            }
          } else {
            console.log("[TRANSLATION] No JSON found in response, raw response length:", rawResponse.length);
            console.log("[TRANSLATION] Raw response preview:", rawResponse.substring(0, 1000));
            const firstBrace = rawResponse.indexOf('{');
            const lastBrace = rawResponse.lastIndexOf('}');
            if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
              let potentialJson = rawResponse.substring(firstBrace, lastBrace + 1);
              try {
                modificationPreview = JSON.parse(potentialJson);
                console.log("[TRANSLATION] Successfully parsed JSON found between braces");
              } catch {
                const repaired = repairJSON(potentialJson);
                if (repaired) {
                  try {
                    modificationPreview = JSON.parse(repaired);
                    console.log("[TRANSLATION] Repaired JSON between braces");
                  } catch {
                    console.log("[TRANSLATION] Could not parse JSON between braces either");
                  }
                }
              }
            }
          }
        } catch (e) {
          console.log("[TRANSLATION] JSON parse error:", e);
          modificationPreview = null;
        }

        if (!modificationPreview) {
          console.log("[TRANSLATION] Failed to parse. Raw response was:", rawResponse.substring(0, 500));
          return NextResponse.json({
            response: `I had trouble generating the translation. The AI returned: ${rawResponse.substring(0, 200)}... Please try again.`,
            links: [],
            results: [],
            isModificationRequest: true,
            needsConfirmation: true,
            modificationType: modType,
            modificationPreview: null,
            editingVersionId: editingVersionId || null,
          });
        }

        const wrappedPreview = modificationPreview && !modificationPreview.modifiedFields
          ? { modifiedFields: modificationPreview }
          : modificationPreview;

        const versionName = (wrappedPreview as any)?.suggestedVersionName || `${lang} Translation`;

        return NextResponse.json({
          response: `I've created "${versionName}". This version is now loaded in the lesson view.`,
          links: [],
          results: [],
          isModificationRequest: true,
          needsConfirmation: false,
          modificationType: modType,
          modificationPreview: wrappedPreview,
          editingVersionId: editingVersionId || null,
          suggestedVersionName: versionName,
        });
      }

      const systemPrompt = getModificationSystemPrompt(modType as "duration" | "translation", modDirection, !!editingVersionId);

      const userMessage = `Please modify the lesson content below according to the teacher's request: "${message}"

${modificationLessonContent}

Return a JSON object with the modified fields and summary.`;

      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        return NextResponse.json({
          response: "AI is not configured. Please contact an administrator.",
          links: [],
          results: [],
          isModificationRequest: true,
          editingVersionId: editingVersionId || null,
        });
      }

      const messages = conversationHistory
        ? [...conversationHistory, { role: "user", content: userMessage }]
        : [{ role: "user", content: userMessage }];

      console.log("[MODIFICATION] Sending request to Anthropic API");
      console.log("[MODIFICATION] Model:", MODIFICATION_MODEL);
      console.log("[MODIFICATION] Message length:", userMessage.length);
      console.log("[MODIFICATION] Editing version:", editingVersionId);
      console.log("[MODIFICATION] Has version content:", !!editingVersionContent);
      console.log("[MODIFICATION] modificationLessonContent length:", modificationLessonContent.length);
      console.log("[MODIFICATION] Contains BASE LESSON:", modificationLessonContent.includes("BASE LESSON"));
      console.log("[MODIFICATION] Contains BASE LESSON CLASS EXPECTATIONS:", modificationLessonContent.includes("BASE LESSON CLASS EXPECTATIONS"));

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
            max_tokens: 8192,
            system: systemPrompt,
            messages: messages.map((m: { role: string; content: string }) => ({
              role: m.role,
              content: m.content,
            })),
          }),
        });
      } catch (fetchError) {
        console.error("[MODIFICATION] Fetch error:", fetchError);
        return NextResponse.json({
          response: "Network error. Please try again.",
          links: [],
          results: [],
          isModificationRequest: true,
          editingVersionId: editingVersionId || null,
        });
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error("[MODIFICATION] Anthropic API error:", response.status, errorText);
        return NextResponse.json({
          response: "AI encountered an error. Please try again.",
          links: [],
          results: [],
          isModificationRequest: true,
          editingVersionId: editingVersionId || null,
        });
      }

      const result = await response.json();
      const rawResponse = result.content?.[0]?.text || "";

      console.log("[MODIFICATION DEBUG] Raw response length:", rawResponse.length);
      console.log("[MODIFICATION DEBUG] Raw response preview:", rawResponse.substring(0, 500));
      console.log("[MODIFICATION DEBUG] Raw response ends with:", rawResponse.substring(rawResponse.length - 100));

      try {
        const jsonMatch = rawResponse.match(/```json\n([\s\S]*?)\n```|(\{[\s\S]*?\})/);
        console.log("[MODIFICATION DEBUG] jsonMatch found:", !!jsonMatch);
        let jsonString = "";
        if (jsonMatch) {
          jsonString = jsonMatch[1] || jsonMatch[2];
          console.log("[MODIFICATION DEBUG] jsonString length:", jsonString.length);
        }
        if (jsonString) {
          try {
            modificationPreview = JSON.parse(jsonString);
            console.log("[MODIFICATION DEBUG] JSON parsed successfully, keys:", modificationPreview ? Object.keys(modificationPreview) : "null");
          } catch (innerErr: unknown) {
            console.error("[MODIFICATION DEBUG] JSON parse FAILED, trying repair:", innerErr instanceof Error ? innerErr.message : String(innerErr));
            const repaired = repairJSON(jsonString);
            if (repaired) {
              try {
                modificationPreview = JSON.parse(repaired);
                console.log("[MODIFICATION DEBUG] Repaired JSON parsed successfully");
              } catch (repairedErr: unknown) {
                console.error("[MODIFICATION DEBUG] Repaired JSON also FAILED:", repairedErr instanceof Error ? repairedErr.message : String(repairedErr));
              }
            }
          }
        } else {
          console.log("[MODIFICATION DEBUG] No JSON found in response");
        }
      } catch (e) {
        console.error("[MODIFICATION DEBUG] Outer error:", e);
      }

      let summary = modificationPreview?.summary || "Modified content ready for review.";
      if (typeof summary === 'object' && summary !== null) {
        summary = (summary as any).text || (summary as any).description || JSON.stringify(summary);
      }

      // Generate suggested version name based on modification type
      let suggestedVersionName = modificationPreview?.suggestedVersionName;
      if (!suggestedVersionName) {
        const date = new Date().toLocaleDateString();
        switch (modType) {
          case "translation":
            suggestedVersionName = `${targetLanguage || "Translated"} Version - ${date}`;
            break;
          case "duration":
            suggestedVersionName = modDirection === "shorter"
              ? `Shorter Version - ${date}`
              : `Extended Version - ${date}`;
            break;
          case "special_needs":
            suggestedVersionName = `Adapted Version - ${date}`;
            break;
          case "materials":
            suggestedVersionName = `Materials Version - ${date}`;
            break;
          case "venue":
            suggestedVersionName = `Venue Version - ${date}`;
            break;
          default:
            suggestedVersionName = `Modified Version - ${date}`;
        }
      }

      const isEditingExisting = !!editingVersionId;
      const isCreatingNew = isVersionMode && versionMode === 'create';
      let responseMessage;
      if (isCreatingNew) {
        responseMessage = `I've created "${suggestedVersionName}". This version is now loaded in the lesson view.`;
      } else if (isEditingExisting) {
        responseMessage = `I've prepared modifications for this version. Review the changes and click Save to update, Save As... to create a new version, or Reject to discard.`;
      } else {
        responseMessage = `I've prepared modifications. ${summary}`;
      }

      if (modType === "translation" || modType === "duration") {
        if (waitingForConfirmation && userSaidProceed) {
          needsConfirmation = false;
        } else {
          needsConfirmation = true;
          modificationPreview = null;
        }
      }

      console.log("[MODIFICATION DEBUG] Final return - needsConfirmation:", needsConfirmation);
      console.log("[MODIFICATION DEBUG] Final return - modificationPreview is null?:", modificationPreview === null);
      console.log("[MODIFICATION DEBUG] Final return - modificationPreview keys:", modificationPreview ? Object.keys(modificationPreview) : "null");

      return NextResponse.json({
        response: responseMessage,
        links: [],
        results: [],
        isModificationRequest: true,
        needsConfirmation,
        modificationType: modType,
        modificationDirection: modDirection,
        modificationPreview,
        editingVersionId: editingVersionId || null,
        suggestedVersionName,
      });
    } else if (effectiveScope === "lesson" && fullLessonContent && !(explicitQuery && hasCurriculumResults)) {
      const lessonUrl = `/admin/courses/${courseId}/lessons/${lessonId}`;
      const systemPrompt = `You are an AI assistant helping a teacher explore THEIR CURRENT LESSON.

CRITICAL RULES:
1. "This lesson" = the lesson shown in the content below
2. Provide specific details, quotes, and examples FROM the lesson content
3. Use EXACT links where provided - do NOT construct your own URLs
4. The lesson URL is: ${lessonUrl}
5. Section links should be: ${lessonUrl}?section={sectionName}
6. Do NOT make up content - only use what's in the lesson content below
7. Be helpful, concise, and specific
8. If user asks about topics or concepts in the lesson, reference the relevant section
9. IMPORTANT: This platform cannot receive files or images. Only ask for text-based explanations or clarifications. Never request screenshots, files, or visual examples.

${currentLessonInfo}

The lesson content is provided below.`;

      const userMessage = `Question: ${message}

${fullLessonContent}`;

      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        return NextResponse.json({
          response: "AI is not configured. Please contact an administrator.",
          links: [],
          results: [],
        });
      }

      const messages = conversationHistory
        ? [...conversationHistory, { role: "user", content: userMessage }]
        : [{ role: "user", content: userMessage }];

      const response = await fetch(ANTHROPIC_API_URL, {
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

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Anthropic API error:", response.status, errorText);
        return NextResponse.json({
          response: "AI encountered an error. Please try again.",
          links: [],
          results: [],
        });
      }

      const result = await response.json();
      aiResponse = result.content?.[0]?.text || "";
      links = extractLinks(aiResponse);
    } else if (effectiveScope === "course" && currentCourseInfo && !(explicitQuery && hasCurriculumResults)) {
      const courseUrl = `/dashboard/courses/${courseId}`;
      const systemPrompt = `You are an AI assistant helping a teacher explore THEIR CURRENT COURSE.

CRITICAL RULES:
1. "This course" = the course described below
2. You can list lessons, summarize the course, discuss its content
3. When mentioning lessons, use the lesson list provided
4. The course URL is: ${courseUrl}
5. Lesson links should be: ${courseUrl}
6. Be helpful, concise, and specific
7. IMPORTANT: This platform cannot receive files or images. Only ask for text-based explanations or clarifications. Never request screenshots, files, or visual examples.

${currentCourseInfo}

Lessons in this course:
${courseLessons.map(l => `- ${l.lesson_number}. ${l.title}`).join("\n")}`;

      const userMessage = `Question: ${message}`;

      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        return NextResponse.json({
          response: "AI is not configured. Please contact an administrator.",
          links: [],
          results: [],
        });
      }

      const messages = conversationHistory
        ? [...conversationHistory, { role: "user", content: userMessage }]
        : [{ role: "user", content: userMessage }];

      const response = await fetch(ANTHROPIC_API_URL, {
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

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Anthropic API error:", response.status, errorText);
        return NextResponse.json({
          response: "AI encountered an error. Please try again.",
          links: [],
          results: [],
        });
      }

      const result = await response.json();
      aiResponse = result.content?.[0]?.text || "";
      links = extractLinks(aiResponse);
    } else if (explicitScope && explicitQuery && hasCurriculumResults) {
      const uniqueLessons = new Set(searchResults.map(r => `${r.course_id}-${r.lesson_id}`)).size;
      const totalResults = searchResults.length;
      const paginatedResults = searchResults.slice(page * pageSize, (page + 1) * pageSize);
      const hasMore = (page + 1) * pageSize < totalResults;
      const responseMsg = totalResults > (page + 1) * pageSize
        ? `Found ${totalResults} matches across ${uniqueLessons} lessons for "${explicitQuery}". Showing ${paginatedResults.length} results.`
        : `Found ${totalResults} matches across ${uniqueLessons} lessons for "${explicitQuery}".`;

      return NextResponse.json({
        response: responseMsg,
        links: [],
        results: paginatedResults,
        totalResults,
        hasMore,
        directResults: formatDirectResults(paginatedResults),
      });
    } else if (hasCurriculumResults && curriculumContext) {
      const systemPrompt = `You are an AI assistant helping teachers explore THEIR OWN lesson content.

CRITICAL RULES:
1. IMC = "In My Content" - the user is searching their own curriculum
2. Search results are provided below from a semantic search - use them to answer the user's question
3. List ALL relevant lessons found, not just one
4. Include specific quotes/details from the content
5. IMPORTANT: Use the EXACT URLs provided in the search results - do NOT construct your own URLs
6. Do NOT make up content or attribute quotes not in the results
7. When mentioning a lesson, include the full markdown link as shown in the search results
8. IMPORTANT: This platform cannot receive files or images. Only ask for text-based explanations or clarifications. Never request screenshots, files, or visual examples.

Search results are provided below.`;

      const userMessage = `${directResults}

User question: ${message}

Answer based on the search results above.`;

      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        return NextResponse.json({
          response: "AI is not configured. Showing direct search results above.",
          links: [],
          results: searchResults.slice(0, 10),
          directResults,
        });
      }

      const messages = conversationHistory
        ? [...conversationHistory, { role: "user", content: userMessage }]
        : [{ role: "user", content: userMessage }];

      const response = await fetch(ANTHROPIC_API_URL, {
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

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Anthropic API error:", response.status, errorText);
        return NextResponse.json({
          response: directResults || "Search completed but AI summary failed.",
          links: [],
          results: searchResults.slice(0, 10),
          directResults,
        });
      }

      const result = await response.json();
      aiResponse = result.content?.[0]?.text || "";
      links = extractLinks(aiResponse);
    } else if (effectiveScope === "global" && wantsContentSearch && !hasCurriculumResults) {
      return NextResponse.json({
        response: `I searched all accessible lessons in your curriculum for "${(explicitQuery || message).replace(/^find all instances of\s*/i, '').replace(/^search all for\s*/i, '')}" but found no matches.\n\nThis term doesn't appear in any of your lesson content. If you expected to find it, please verify the exact spelling or try a different search term.`,
        links: [],
        results: [],
      });
    } else if (explicitScope && explicitQuery && !hasCurriculumResults) {
      const scopeLabel = effectiveScope === "lesson" ? "this lesson" : effectiveScope === "course" ? "this course" : "all accessible lessons";
      return NextResponse.json({
        response: `I searched ${scopeLabel} for "${explicitQuery}" but found no matches.\n\nThis term doesn't appear in any of the content. Please verify the exact spelling or try a different search term.`,
        links: [],
        results: [],
      });
    } else {
      const systemPrompt = `You are a helpful AI assistant for music, dance, and theatre education.
You help teachers with questions about VAPA standards, NCAS standards, curriculum design, pedagogy, lesson planning, and general music/dance/theatre education topics.
Be concise and helpful in your responses.
IMPORTANT: This platform cannot receive files or images. Only ask for text-based explanations or clarifications. Never request screenshots, files, or visual examples.`;

      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (apiKey) {
        const messages = conversationHistory
          ? [...conversationHistory, { role: "user", content: message }]
          : [{ role: "user", content: message }];

        const response = await fetch(ANTHROPIC_API_URL, {
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

        if (response.ok) {
          const result = await response.json();
          aiResponse = result.content?.[0]?.text || "";
        }
      }
    }

    return NextResponse.json({
      response: aiResponse || directResults || "No results found for your query.",
      links,
      results: searchResults.slice(0, 10),
      directResults: hasCurriculumResults ? directResults : undefined,
    });
  } catch (error: unknown) {
    const errMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Chat API error:", error);
    return NextResponse.json({ error: errMessage }, { status: 500 });
  }
}

function buildVectorSearchContext(results: SearchResult[]): string {
  const grouped = new Map<string, { lesson: SearchResult; chunks: SearchResult[] }>();

  for (const result of results) {
    const key = `${result.lesson_id}-${result.field_name}`;
    if (!grouped.has(key)) {
      grouped.set(key, { lesson: result, chunks: [] });
    }
    grouped.get(key)!.chunks.push(result);
  }

  const lines: string[] = [];
  lines.push(`Found ${results.length} relevant sections across ${grouped.size} lessons:\n`);

  for (const [, { lesson, chunks }] of grouped) {
    const fieldLabel = formatFieldName(lesson.field_name);
    const relevance = Math.round(lesson.similarity * 100);
    lines.push(`\n--- ${lesson.course_title} - Grade ${lesson.grade} | Lesson ${lesson.lesson_number}: ${lesson.lesson_title} | ${fieldLabel} (${relevance}% match) ---\n`);
    lines.push(`URL: /admin/courses/${lesson.course_id}/lessons/${lesson.lesson_id}?section=${lesson.field_name}`);
    for (const chunk of chunks.slice(0, 2)) {
      lines.push(`\n${chunk.chunk_text}`);
    }
  }

  return lines.join("\n");
}

function buildKeywordSearchContext(results: SearchResult[]): string {
  const grouped = new Map<string, SearchResult[]>();

  for (const result of results) {
    const key = `${result.lesson_id}-${result.field_name}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(result);
  }

  const lines: string[] = [];
  lines.push(`Found ${results.length} matches across ${grouped.size} lessons:\n`);

  for (const [, chunks] of grouped) {
    const first = chunks[0];
    const fieldLabel = formatFieldName(first.field_name);
    lines.push(`\n--- ${first.course_title} - Grade ${first.grade} | Lesson ${first.lesson_number}: ${first.lesson_title} | ${fieldLabel} ---\n`);
    lines.push(`URL: /admin/courses/${first.course_id}/lessons/${first.lesson_id}?section=${first.field_name}`);
    lines.push(`\n"${first.chunk_text}"`);
  }

  return lines.join("\n");
}

function formatDirectResults(results: SearchResult[]): string {
  const grouped = new Map<string, SearchResult[]>();
  for (const result of results) {
    const key = `${result.lesson_id}-${result.field_name}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(result);
  }

  const lessons = [...grouped.entries()].map(([key, chunks]) => {
    const first = chunks[0];
    const fieldLabel = formatFieldName(first.field_name);
    return {
      key,
      courseTitle: first.course_title,
      grade: first.grade,
      lessonNumber: first.lesson_number,
      lessonTitle: first.lesson_title,
      fieldName: first.field_name,
      fieldLabel,
      url: `/lessons/${first.lesson_id}#${first.field_name}`,
      snippet: chunks[0].chunk_text,
  };

  });

  const lines: string[] = [];
  lines.push(`**Search Results** (${results.length} matches across ${lessons.length} lessons):\n\n`);

  for (const lesson of lessons.slice(0, 10)) {
    lines.push(`**${lesson.courseTitle} - Grade ${lesson.grade} | Lesson ${lesson.lessonNumber}: ${lesson.lessonTitle}**`);
    lines.push(`Section: ${lesson.fieldLabel}`);
    lines.push(`Link: ${lesson.url}`);
    lines.push(`Snippet: "${lesson.snippet}..."\n`);
  }

  return lines.join("\n");
}

function formatFieldName(fieldName: string): string {
  const labels: Record<string, string> = {
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
  return labels[fieldName] || fieldName;
}

function extractLinks(text: string): { label: string; url: string }[] {
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  const links: { label: string; url: string }[] = [];
  let match;

  while ((match = linkRegex.exec(text)) !== null) {
    links.push({ label: match[1], url: match[2] });
  }

  return links;
}
