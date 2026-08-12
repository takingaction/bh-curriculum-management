import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { searchLessons, getLessonDetails, listMyCourses } from "@/lib/search-utils";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-haiku-4-5";
const MAX_TOKENS = 1024;

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

export async function POST(request: Request) {
  const body = await request.json();
  const { message, lessonId, courseId, conversationHistory } = body;

  if (!message) {
    return NextResponse.json({ error: "Message is required" }, { status: 400 });
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

  const { scope: prefixScope, query: prefixQuery } = detectScopePrefix(message);
  const processedMessage = prefixScope ? prefixQuery : message;

  // Determine context for AI tools based on prefix
  const searchCourseId = prefixScope === "course" ? courseId : undefined;
  const searchLessonId = prefixScope === "lesson" ? lessonId : undefined;

  // Check for "translate into [language]" - this is a modification request, redirect to Versions tab
  const lowerMessage = message.toLowerCase();
  const isTranslateIntoRequest = /translate\s+into\s+\w+/i.test(lowerMessage) ||
    /create\s+a\s+\w+\s+version/i.test(lowerMessage) ||
    /make\s+it\s+\w+/i.test(lowerMessage) ||
    /make\s+this\s+lesson\s+\w+/i.test(lowerMessage);
  
  if (isTranslateIntoRequest) {
    return NextResponse.json({
      response: "To create a translated version of this lesson, please use the Versions tab.",
      links: [],
      results: [],
    });
  }

  const systemPrompt = `You are a helpful AI assistant for music, dance, and theatre education.
You help teachers with questions about VAPA standards, NCAS standards, curriculum design, pedagogy, lesson planning, and general music/dance/theatre education topics.

UNDERSTANDING PREFIXES:
- "curriculum: <question>" → Search ALL enrolled courses (use search_lessons WITHOUT course_id filter)
- "course: <question>" → Search WITHIN CURRENT COURSE (use search_lessons WITH course_id = current course)
- "lesson: <question>" → Get details about CURRENT LESSON (use get_lesson_details WITH lesson_id = current lesson)

EXAMPLES:
- "curriculum: which lessons cover rhythm?" → use search_lessons tool (no course_id)
- "course: how many lessons are in it?" → use search_lessons tool WITH course_id = provided course ID
- "lesson: what are the learning objectives?" → use get_lesson_details tool with lesson_id = provided lesson ID

CRITICAL: When a prefix is used, NEVER ask for clarification. The course_id/lesson_id are already provided automatically!

Be concise and helpful in your responses.
IMPORTANT: This platform cannot receive files or images. Only ask for text-based explanations or clarifications. Never request screenshots, files, or visual examples.`;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({
      response: "AI is not configured. Please contact an administrator.",
      links: [],
      results: [],
    });
  }

  const messages = conversationHistory
    ? [...conversationHistory.map((m: { role: string; content: string }) => ({ role: m.role, content: m.content })), { role: "user" as const, content: processedMessage }]
    : [{ role: "user" as const, content: processedMessage }];

  let toolResponse;
  try {
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
        tool_choice: { type: "any" },
        system: systemPrompt,
        messages,
      }),
    });
  } catch (err) {
    return NextResponse.json({
      response: "Failed to connect to AI. Please try again.",
      links: [],
      results: [],
    });
  }

  let toolResult = await toolResponse.json();
  let aiResponse = "";

  while (toolResult.stop_reason === "tool_use") {
    const toolUses = toolResult.content.filter((c: { type: string }) => c.type === "tool_use");

    for (const toolUse of toolUses) {
      const toolName = toolUse.name;
      const toolInput = toolUse.input;

      let result: unknown;
      try {
        if (toolName === "search_lessons") {
          const finalCourseId = searchCourseId || toolInput.course_id;
          result = await searchLessons({
            query: toolInput.query,
            grade: toolInput.grade,
            courseId: finalCourseId,
            discipline: toolInput.discipline,
            maxResults: toolInput.max_results || 10,
            userId,
          });
        } else if (toolName === "get_lesson_details") {
          result = await getLessonDetails({
            lesson_id: searchLessonId || toolInput.lesson_id,
            sections: toolInput.sections,
          });
        } else if (toolName === "list_my_courses") {
          result = await listMyCourses(userId);
        } else {
          result = { error: `Unknown tool: ${toolName}` };
        }
      } catch (err) {
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
  const links: { label: string; url: string }[] = [];

  return NextResponse.json({
    response: aiResponse,
    links,
    results: [],
  });
}
