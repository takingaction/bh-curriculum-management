import { createClient } from "@/lib/supabase/server";
import { findMatchesInContent, generateSnippet, TEXT_FIELDS_LIST } from "@/lib/html-utils";

export interface SearchResult {
  lesson_id: string;
  field_name: string;
  chunk_text: string;
  similarity: number;
  lesson_number?: number;
  lesson_title?: string;
  course_title?: string;
  course_id?: string;
  grade?: string;
  discipline?: string;
}

export interface Course {
  id: string;
  title: string;
  discipline: string;
  grade: string;
}

export interface SearchLessonsParams {
  query: string;
  grade?: string | string[];
  courseId?: string;
  discipline?: string;
  maxResults?: number;
  userId: string;
}

export interface SearchLessonsResult {
  lessons: {
    id: string;
    lesson_number: number;
    title: string;
    course_id: string;
    course_title: string;
    discipline: string;
    grade: string;
    field_matches: {
      field_name: string;
      field_label: string;
      snippet: string;
    }[];
    url: string;
  }[];
  total_matches: number;
  search_scope: "all" | "course" | "lesson";
}

export interface GetLessonDetailsParams {
  lesson_id: string;
  sections?: string[];
}

export interface GetLessonDetailsResult {
  id: string;
  lesson_number: number;
  title: string;
  course_id: string;
  course_title: string;
  discipline: string;
  grade: string;
  content: {
    [key: string]: string;
  };
  url: string;
}

export interface ListMyCoursesResult {
  courses: {
    id: string;
    title: string;
    discipline: string;
    grade: string;
    lesson_count: number;
  }[];
  total_count: number;
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

function getFieldLabel(fieldName: string): string {
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

export async function searchLessons(params: SearchLessonsParams): Promise<SearchLessonsResult> {
  const { query, grade, courseId, discipline, maxResults = 10, userId } = params;

  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("Unauthorized");
  }

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
    return { lessons: [], total_matches: 0, search_scope: "all" };
  }

  let lessonsQuery = supabase
    .from("lessons")
    .select("id, lesson_number, title, course_id, courses(id, title, discipline, grade), " + TEXT_FIELDS_LIST.join(", "));

  if (courseId) {
    lessonsQuery = lessonsQuery.eq("course_id", courseId);
  } else {
    lessonsQuery = lessonsQuery.in("course_id", filteredCourseIds);
  }

  const { data: lessons, error: lessonsError } = await lessonsQuery;

  if (lessonsError || !lessons) {
    throw new Error("Failed to fetch lessons");
  }

  let filteredLessons = lessons;

  if (grade) {
    const grades = Array.isArray(grade) ? grade : [grade];
    filteredLessons = filteredLessons.filter((lesson: any) => {
      const lessonCourse = lesson.courses as Course;
      return grades.some(g => 
        lessonCourse?.grade?.toUpperCase() === g.toUpperCase() ||
        lessonCourse?.grade === g
      );
    });
  }

  if (discipline) {
    filteredLessons = filteredLessons.filter((lesson: any) => {
      const lessonCourse = lesson.courses as Course;
      return lessonCourse?.discipline?.toUpperCase() === discipline.toUpperCase();
    });
  }

  const matchesMap = new Map<string, {
    lesson: any;
    matches: { fieldName: string; snippet: string }[];
  }>();

  for (const lesson of filteredLessons) {
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
      const key = lessonIdStr;

      if (!matchesMap.has(key)) {
        matchesMap.set(key, {
          lesson: lessonAny,
          matches: [],
        });
      }

      matchesMap.get(key)!.matches.push({
        fieldName,
        snippet,
      });
    }
  }

  const results: SearchLessonsResult["lessons"] = [];
  let totalMatches = 0;

  for (const [lessonId, { lesson: lessonAny, matches }] of matchesMap.entries()) {
    const course = lessonAny.courses as Course;
    
    results.push({
      id: lessonAny.id,
      lesson_number: lessonAny.lesson_number,
      title: lessonAny.title,
      course_id: lessonAny.course_id,
      course_title: course?.title || "Unknown Course",
      discipline: course?.discipline || "",
      grade: course?.grade || "",
      field_matches: matches.map(m => ({
        field_name: m.fieldName,
        field_label: getFieldLabel(m.fieldName),
        snippet: m.snippet,
      })),
      url: `/lessons/${lessonAny.id}`,
    });
    totalMatches += matches.length;

    if (results.length >= maxResults) break;
  }

  return {
    lessons: results,
    total_matches: totalMatches,
    search_scope: courseId ? "course" : "all",
  };
}

export async function getLessonDetails(params: GetLessonDetailsParams): Promise<GetLessonDetailsResult | null> {
  const { lesson_id, sections } = params;

  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("Unauthorized");
  }

  const fieldsToSelect = sections && sections.length > 0
    ? `id, lesson_number, title, course_id, courses(id, title, discipline, grade), ${sections.join(", ")}`
    : `id, lesson_number, title, course_id, courses(id, title, discipline, grade), ${TEXT_FIELDS_LIST.join(", ")}`;

  const { data: lesson, error } = await supabase
    .from("lessons")
    .select(fieldsToSelect)
    .eq("id", lesson_id)
    .single();

  if (error || !lesson) {
    return null;
  }

  const lessonAny = lesson as any;
  const course = lessonAny.courses as Course;

  const content: { [key: string]: string } = {};
  for (const fieldName of TEXT_FIELDS_LIST) {
    if (lessonAny[fieldName]) {
      content[fieldName] = lessonAny[fieldName];
    }
  }

  return {
    id: lessonAny.id,
    lesson_number: lessonAny.lesson_number,
    title: lessonAny.title,
    course_id: lessonAny.course_id,
    course_title: course?.title || "Unknown Course",
    discipline: course?.discipline || "",
    grade: course?.grade || "",
    content,
    url: `/lessons/${lessonAny.id}`,
  };
}

export async function listMyCourses(userId: string): Promise<ListMyCoursesResult> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("Unauthorized");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("enrollments")
    .eq("id", userId)
    .single();

  const enrollments = profile?.enrollments || [];

  const { data: allCourses, error: coursesError } = await supabase
    .from("courses")
    .select("id, title, discipline, grade");

  if (coursesError || !allCourses) {
    throw new Error("Failed to fetch courses");
  }

  const filteredCourses = filterCoursesByEnrollment(
    allCourses as Course[],
    enrollments
  );

  const { data: lessonsData } = await supabase
    .from("lessons")
    .select("course_id");

  const lessonCounts = new Map<string, number>();
  if (lessonsData) {
    for (const lesson of lessonsData) {
      const count = lessonCounts.get(lesson.course_id) || 0;
      lessonCounts.set(lesson.course_id, count + 1);
    }
  }

  const courses = filteredCourses.map((course: Course) => ({
    id: course.id,
    title: course.title,
    discipline: course.discipline,
    grade: course.grade,
    lesson_count: lessonCounts.get(course.id) || 0,
  }));

  return {
    courses,
    total_count: courses.length,
  };
}
