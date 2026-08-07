import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { findMatchesInContent, generateSnippet, TEXT_FIELDS_LIST } from "@/lib/html-utils";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-haiku-4-5";
const MAX_TOKENS = 1024;

const CURRICULUM_TRIGGER = "imc";

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

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { message, conversationHistory, lessonId, courseId, scope: explicitScope, searchQuery: explicitQuery, page = 0, pageSize = 10 } = body;

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

    const wantsContentSearch = explicitScope ? true : (shouldReadContent(message) || effectiveScope !== "ask");

    let searchResults: SearchResult[] = [];
    let curriculumContext = "";

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

    if (effectiveScope === "ask" && !explicitScope) {
      return NextResponse.json({
        response: "I can help you explore your curriculum or answer general questions about music, dance, and theatre education.\n\nWould you like me to:\n**A)** Search your lesson content for specific terms or topics\n**B)** Answer a general question about music/dance/theatre education\n\nJust tell me what you'd like to do, or specify: \"search all content for [topic]\", \"search this course for [topic]\", or \"search this lesson for [topic]\".",
        links: [],
        results: [],
        needsScope: true,
      });
    }

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
        currentLessonInfo = `Current lesson context: "${fullLesson.title}" (Course: ${course?.title || "Unknown"}, Grade: ${course?.grade || "Unknown"}, Lesson #: ${fullLesson.lesson_number})`;
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
      }
    }

    const hasCurriculumResults = searchResults.length > 0;
    const directResults = hasCurriculumResults
      ? formatDirectResults(searchResults)
      : "";

    let aiResponse = "";
    let links: { label: string; url: string }[] = [];

    if (effectiveScope === "lesson" && fullLessonContent && !(explicitQuery && hasCurriculumResults)) {
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
Be concise and helpful in your responses.`;

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
