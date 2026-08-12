import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { searchLessons, getLessonDetails, listMyCourses } from "@/lib/search-utils";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-5";
const MAX_TOKENS = 2048;

const TOOL_SEARCH_LESSONS = {
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
};

const TOOL_GET_LESSON_DETAILS = {
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
};

const TOOL_LIST_MY_COURSES = {
  name: "list_my_courses",
  description: "Lists all courses the user has access to, grouped by discipline and grade.",
  input_schema: {
    type: "object",
    properties: {}
  }
};

function getTools(scope: string | null) {
  if (scope === "course" || scope === "lesson") {
    return [TOOL_SEARCH_LESSONS, TOOL_GET_LESSON_DETAILS];
  }
  return [TOOL_SEARCH_LESSONS, TOOL_GET_LESSON_DETAILS, TOOL_LIST_MY_COURSES];
}

export async function POST(request: Request) {
  const body = await request.json();
  const { message, lessonId, courseId, scope, conversationHistory } = body;

  if (!message) {
    return NextResponse.json({ error: "Message is required" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = user.id;

  let searchCourseId: string | undefined;
  let searchLessonId: string | undefined;

  if (scope === "curriculum") {
    searchCourseId = undefined;
    searchLessonId = undefined;
  } else if (scope === "course") {
    searchCourseId = courseId || undefined;
    searchLessonId = undefined;
  } else if (scope === "lesson") {
    searchCourseId = undefined;
    searchLessonId = lessonId || undefined;
  }

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

  let systemPrompt = `You are a helpful AI assistant for music, dance, and theatre education.
You help teachers with questions about VAPA standards, NCAS standards, curriculum design, pedagogy, lesson planning, and general music/dance/theatre education topics.`;

  if (scope === "curriculum") {
    systemPrompt += `

SCOPE: The user has selected "Curriculum" scope. Search across ALL enrolled courses using the search_lessons tool (without course_id filter).`;
  } else if (scope === "course") {
    systemPrompt += `

SCOPE: The user has selected "Course" scope. Use search_lessons tool with the provided course_id to search within the current course only.`;
  } else if (scope === "lesson") {
    systemPrompt += `

SCOPE: The user has selected "Lesson" scope. Use get_lesson_details tool with the provided lesson_id to get details about the current lesson.`;
  }

  systemPrompt += `

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
    ? [...conversationHistory.map((m: { role: string; content: string }) => ({ role: m.role as "user" | "assistant", content: m.content })), { role: "user", content: message }]
    : [{ role: "user", content: message }];

  const tools = getTools(scope);
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
        tools,
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
          let finalCourseId: string | undefined;

          if (scope === "course") {
            if (!searchCourseId) {
              result = { error: "Please navigate to a course page first to search within a course." };
            } else {
              finalCourseId = searchCourseId;
            }
          } else if (scope === "lesson") {
            finalCourseId = toolInput.course_id;
          } else {
            finalCourseId = searchCourseId || toolInput.course_id;
          }

          if (result) {
            messages.push({ role: "assistant", content: toolResult.content });
            messages.push({ role: "user", content: [{ type: "tool_result", tool_use_id: toolUse.id, content: JSON.stringify(result) }] });
            continue;
          }

          result = await searchLessons({
            query: toolInput.query,
            grade: toolInput.grade,
            courseId: finalCourseId,
            discipline: toolInput.discipline,
            maxResults: toolInput.max_results || 10,
            userId,
          });
        } else if (toolName === "get_lesson_details") {
          let finalLessonId: string | undefined;

          if (scope === "lesson") {
            if (!searchLessonId) {
              result = { error: "Please navigate to a lesson page first to search within a lesson." };
            } else {
              finalLessonId = searchLessonId;
            }
          } else if (scope === "course") {
            finalLessonId = toolInput.lesson_id;
          } else {
            finalLessonId = searchLessonId || toolInput.lesson_id;
          }

          if (result) {
            messages.push({ role: "assistant", content: toolResult.content });
            messages.push({ role: "user", content: [{ type: "tool_result", tool_use_id: toolUse.id, content: JSON.stringify(result) }] });
            continue;
          }

          result = await getLessonDetails({
            lesson_id: finalLessonId!,
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
        tools,
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
