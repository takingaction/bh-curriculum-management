import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { findMatchesInContent, generateSnippet, TEXT_FIELDS_LIST } from "@/lib/html-utils";

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

interface Course {
  id: string;
  title: string;
  discipline: string;
  grade: string;
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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") || "";
  const scope = searchParams.get("scope") || "global"; // lesson, course, global
  const lessonId = searchParams.get("lessonId");
  const courseId = searchParams.get("courseId");
  const page = parseInt(searchParams.get("page") || "0");
  const pageSize = parseInt(searchParams.get("pageSize") || "10");

  if (!query || query.length < 2) {
    return NextResponse.json({
      results: [],
      totalResults: 0,
      hasMore: false,
    });
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

  const { data: allCourses } = await supabase
    .from("courses")
    .select("id, title, discipline, grade");

  const filteredCourses = filterCoursesByEnrollment(
    (allCourses || []) as Course[],
    enrollments
  );

  const filteredCourseIds = filteredCourses.map((c: Course) => c.id);

  if (filteredCourseIds.length === 0) {
    return NextResponse.json({
      results: [],
      totalResults: 0,
      hasMore: false,
    });
  }

  let lessonsQuery = supabase
    .from("lessons")
    .select("id, lesson_number, title, course_id, courses(id, title, discipline, grade), " + TEXT_FIELDS_LIST.join(", "));

  if (scope === "lesson" && lessonId) {
    lessonsQuery = lessonsQuery.eq("id", lessonId);
  } else if (scope === "course" && courseId) {
    lessonsQuery = lessonsQuery.eq("course_id", courseId);
  } else {
    lessonsQuery = lessonsQuery.in("course_id", filteredCourseIds);
  }

  const { data: lessons, error: lessonsError } = await lessonsQuery;

  if (lessonsError || !lessons) {
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }

  const matchesMap = new Map<string, SearchResult>();

  for (const lesson of lessons) {
    const lessonAny = lesson as any;
    const course = lessonAny.courses;
    const lessonIdStr = lessonAny.id;
    const courseIdStr = lessonAny.course_id;

    for (const fieldName of TEXT_FIELDS_LIST) {
      const fieldValue = lessonAny[fieldName];
      if (!fieldValue || typeof fieldValue !== "string") continue;

      const matches = findMatchesInContent(fieldValue, query, fieldName, false);
      if (!matches || matches.matches.length === 0) continue;

      const snippet = generateSnippet(fieldValue, query);
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

  const searchResults = Array.from(matchesMap.values());
  const totalResults = searchResults.length;
  const paginatedResults = searchResults.slice(page * pageSize, (page + 1) * pageSize);
  const hasMore = (page + 1) * pageSize < totalResults;

  return NextResponse.json({
    results: paginatedResults,
    totalResults,
    hasMore,
  });
}
