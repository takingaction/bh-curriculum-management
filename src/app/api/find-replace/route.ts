import { createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { replaceTextInHTML, findMatchesInContent, generateSnippet, TEXT_FIELDS_LIST, replaceTextPreserveCase } from "@/lib/html-utils";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search");
  const scope = searchParams.get("scope") as "lesson" | "course" | "global";
  const lessonId = searchParams.get("lessonId");
  const courseId = searchParams.get("courseId");
  const caseSensitive = searchParams.get("caseSensitive") !== "false";

  if (!search || !scope) {
    return NextResponse.json({ error: "Missing search or scope" }, { status: 400 });
  }

  try {
    const supabase = await createServiceClient();

    let lessonsQuery = supabase
      .from("lessons")
      .select("id, lesson_number, title, course_id, lesson_outline, learning_objectives, vocabulary, materials, vapa_text_block, ncas_text_block, welcome_opening, actual_class_expectations, warm_up, lesson_hook, main_activity, instrument_expectations, reflection, closing_ceremony, assessment, courses(id, title, discipline, grade)");

    if (scope === "lesson" && lessonId) {
      lessonsQuery = lessonsQuery.eq("id", lessonId);
    } else if (scope === "course" && courseId) {
      lessonsQuery = lessonsQuery.eq("course_id", courseId);
    }

    const { data: lessons, error: lessonsError } = await lessonsQuery;

    if (lessonsError) {
      return NextResponse.json({ error: lessonsError.message }, { status: 500 });
    }

    if (!lessons || lessons.length === 0) {
      return NextResponse.json({ matches: [], totalMatches: 0, totalLessons: 0 });
    }

    // Deduplicate lessons by ID
    const seenLessonIds = new Set();
    const uniqueLessons = lessons.filter((l: any) => {
      if (seenLessonIds.has(l.id)) return false;
      seenLessonIds.add(l.id);
      return true;
    });

    const matchesMap = new Map<string, any>();
    let totalMatches = 0;

    for (const lesson of uniqueLessons) {
      const lessonAny = lesson as any;
      const course = lessonAny.courses as any;

      for (const fieldName of TEXT_FIELDS_LIST) {
        const fieldValue = lessonAny[fieldName];
        if (!fieldValue || typeof fieldValue !== "string") continue;

        const fieldMatches = findMatchesInContent(fieldValue, search, fieldName, caseSensitive);
        if (!fieldMatches || fieldMatches.matches.length === 0) continue;

        const snippet = generateSnippet(fieldValue, search);
        const key = `${lesson.id}-${fieldName}`;

        const existing = matchesMap.get(key);
        if (existing) {
          existing.count += fieldMatches.matches.length;
        } else {
          matchesMap.set(key, {
            lessonId: lesson.id,
            lessonNumber: lesson.lesson_number,
            lessonTitle: lesson.title,
            courseId: lesson.course_id,
            courseName: course?.title || "Unknown Course",
            fieldName,
            fieldLabel: fieldMatches.fieldLabel,
            snippet,
            count: fieldMatches.matches.length,
          });
          totalMatches += fieldMatches.matches.length;
        }
      }
    }

    const matches = Array.from(matchesMap.values());

    matches.sort((a, b) => {
      if (a.courseName !== b.courseName) return a.courseName.localeCompare(b.courseName);
      if (a.lessonNumber !== b.lessonNumber) return a.lessonNumber - b.lessonNumber;
      return a.fieldName.localeCompare(b.fieldName);
    });

    return NextResponse.json({
      matches,
      totalMatches,
      totalLessons: uniqueLessons.length,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { search, replace, scope, lessonId, courseId, caseSensitive = true, forceExactCase = true } = body;

    if (!search || replace === undefined || !scope) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const supabase = await createServiceClient();

    let lessonsQuery = supabase
      .from("lessons")
      .select("id, lesson_number, title, course_id, lesson_outline, learning_objectives, vocabulary, materials, vapa_text_block, ncas_text_block, welcome_opening, actual_class_expectations, warm_up, lesson_hook, main_activity, instrument_expectations, reflection, closing_ceremony, assessment");

    if (scope === "lesson" && lessonId) {
      lessonsQuery = lessonsQuery.eq("id", lessonId);
    } else if (scope === "course" && courseId) {
      lessonsQuery = lessonsQuery.eq("course_id", courseId);
    }

    const { data: lessons, error: lessonsError } = await lessonsQuery;

    if (lessonsError) {
      return NextResponse.json({ error: lessonsError.message }, { status: 500 });
    }

    if (!lessons || lessons.length === 0) {
      return NextResponse.json({ updatedCount: 0, lessonsUpdated: 0 });
    }

    let updatedCount = 0;
    const updatedLessonIds = new Set<string>();

    for (const lesson of lessons) {
      const lessonAny = lesson as any;
      const updates: Record<string, string> = {};
      let lessonHasUpdates = false;

      for (const fieldName of TEXT_FIELDS_LIST) {
        const fieldValue = lessonAny[fieldName];
        if (!fieldValue || typeof fieldValue !== "string") continue;

        let newContent: string;
        if (forceExactCase) {
          newContent = replaceTextInHTML(fieldValue, search, replace, caseSensitive);
        } else {
          newContent = replaceTextPreserveCase(fieldValue, search, replace, caseSensitive);
        }

        if (newContent !== fieldValue) {
          updates[fieldName] = newContent;
          updatedCount++;
          lessonHasUpdates = true;
        }
      }

      if (lessonHasUpdates) {
        const { error: updateError } = await supabase
          .from("lessons")
          .update(updates)
          .eq("id", lesson.id);

        if (!updateError) {
          updatedLessonIds.add(lesson.id);
        }
      }
    }

    return NextResponse.json({
      updatedCount,
      lessonsUpdated: updatedLessonIds.size,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
