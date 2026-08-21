import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { searchLessons, getLessonDetails, getCourseLessons, getAllLessons, listMyCourses, GetLessonDetailsResult } from "@/lib/search-utils";
import { htmlToPlainText } from "@/lib/html-utils";

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
ALWAYS check the "total_matches" field in the response - it shows the ACTUAL total count of all matching content, which may be larger than the number of lessons returned (capped by max_results).

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
        description: "Maximum number of lessons to return (default: 25, max: 100). Note: The search also returns total_matches which shows the actual total count of matching content.",
        default: 25
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

// Note: searchLessons is DEACTIVATED for Course scope - use get_course_lessons instead
const TOOL_GET_COURSE_LESSONS = {
  name: "get_course_lessons",
  description: `Retrieves all lessons in a course with their full content.

Use this when the user wants to see all lessons in a course, reason over the entire course content, or ask general questions about the course.

Note: searchLessons is deactivated for Course scope. Use this tool instead.`,
  input_schema: {
    type: "object",
    properties: {
      course_id: {
        type: "string",
        description: "The UUID of the course. Optional - if not provided, the system will use the current course context."
      }
    },
    required: []
  }
};

// Note: searchLessons is DEACTIVATED for Curriculum scope - use get_all_lessons instead
const TOOL_GET_ALL_LESSONS = {
  name: "get_all_lessons",
  description: `Retrieves all enrolled lessons with their learning objectives for curriculum-level reasoning.

Use this to get a complete picture of the user's curriculum. Returns all enrolled courses and lessons with learning_objectives summaries.

Note: searchLessons is deactivated for Curriculum scope. Use this tool instead. For specific keyword searches in full content, direct the user to the Search tab.`,
  input_schema: {
    type: "object",
    properties: {}
  }
};

function getTools(scope: string | null) {
  if (scope === "course") {
    // searchLessons DEACTIVATED for Course scope - use get_course_lessons instead
    return [TOOL_GET_COURSE_LESSONS, TOOL_GET_LESSON_DETAILS];
  }
  if (scope === "lesson") {
    return [TOOL_SEARCH_LESSONS, TOOL_GET_LESSON_DETAILS];
  }
  // curriculum scope - searchLessons DEACTIVATED - use get_all_lessons instead
  return [TOOL_GET_ALL_LESSONS, TOOL_GET_LESSON_DETAILS, TOOL_LIST_MY_COURSES];
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

SCOPE: The user has selected "Curriculum" scope. You MUST use the get_all_lessons tool to get all enrolled lessons with their learning objectives.

CRITICAL RULES FOR CURRICULUM SCOPE:
1. You MUST call get_all_lessons tool - do NOT skip this step
2. Do NOT make up lesson names, course names, or content from your training data
3. You see only learning_objectives summaries (not full lesson content)
4. Always call get_all_lessons FIRST before answering any curriculum question

WHAT YOU CAN ANSWER:
- Questions about topics, skills, standards across the curriculum
- Which lessons are about certain themes (based on learning_objectives)
- Curriculum overview and progression
- Comparison of courses or grades

WHAT YOU CANNOT ANSWER:
- Specific word/phrase searches in full lesson content
- Details not in learning_objectives
- If asked "which lessons mention [specific word]", say: "I only have access to learning objectives summaries, not full content. For keyword searches, please use the Search tab."

TOOLS:
- get_all_lessons: Call this tool to get all enrolled lessons with learning_objectives
- list_my_courses: Lists enrolled courses (use for course names/structure)
- get_lesson_details: For full content of a specific lesson - user should use Lesson button instead

If the user asks about curriculum structure, topics, or overview, call get_all_lessons immediately.`;
  } else if (scope === "course") {
    systemPrompt += `

SCOPE: The user has selected "Course" scope. You MUST use the get_course_lessons tool to get all lessons with their full content. The course_id is automatically provided by the system - do NOT ask the user for it.

CRITICAL RULES FOR COURSE SCOPE:
1. You MUST call get_course_lessons tool - do NOT skip this step
2. Do NOT make up lesson names, lesson numbers, or course information from your training data
3. Do NOT say you cannot access course data - you CAN via the get_course_lessons tool
4. Always call get_course_lessons FIRST before answering any question about course lessons

TOOLS:
- get_course_lessons: Call this tool with course_id (auto-provided) to get ALL lessons with full content
- get_lesson_details: Rarely needed - user should use Lesson button for single lesson questions

If the user asks about lessons in this course, call get_course_lessons immediately.`;
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

          const lessonDetails = await getLessonDetails({
            lesson_id: finalLessonId!,
            sections: toolInput.sections,
          });

          // Strip HTML from lesson content for ASK tab (only affects AI, not VERSIONS)
          if (lessonDetails && lessonDetails.content) {
            for (const field of Object.keys(lessonDetails.content)) {
              lessonDetails.content[field] = htmlToPlainText(lessonDetails.content[field]);
            }
          }

          result = lessonDetails;
        } else if (toolName === "list_my_courses") {
          result = await listMyCourses(userId);
        } else if (toolName === "get_course_lessons") {
          const courseId = toolInput.course_id || searchCourseId;
          if (!courseId) {
            result = { error: "Please navigate to a course page first." };
          } else {
            result = await getCourseLessons(courseId);
          }
        } else if (toolName === "get_all_lessons") {
          result = await getAllLessons(userId);
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
