import { createServiceClient } from "@/lib/supabase/server";
import sanitizeHtml from "sanitize-html";
import { transformHtml } from "@/lib/html-transforms";
import { NextResponse } from "next/server";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";

function transformImageUrls(html: string, courseId: string): { html: string; missingImages: string[] } {
  const missingImages: string[] = [];
  const storageBase = `${SUPABASE_URL}/storage/v1/object/public/course-images/${courseId}/image`;

  const htmlWithUrls = html.replace(/src="image\/([^"]+)"/g, (match, filename) => {
    return `src="${storageBase}/${filename}"`;
  });

  const referencedImages = [...htmlWithUrls.matchAll(/src="([^"]+image\/([^"]+))"/g)]
    .map(([, fullUrl]) => {
      const filename = fullUrl.split("/").pop();
      return filename;
    })
    .filter(Boolean);

  return { html: htmlWithUrls, missingImages };
}

export async function POST(request: Request) {
  try {
    const supabaseAdmin = await createServiceClient();
    const body = await request.json();
    const { courseInfo, csvData, fieldMappings }: { courseInfo: any; csvData: any[]; fieldMappings: Record<string, string> } = body;

    let courseId: string | null = null;

    // Check if course already exists
    const { data: existingCourse } = await supabaseAdmin
      .from("courses")
      .select("id")
      .eq("title", courseInfo.title)
      .eq("discipline", courseInfo.discipline)
      .eq("grade", courseInfo.grade)
      .single();

    if (existingCourse) {
      courseId = existingCourse.id;
    } else {
      const { data: newCourse, error } = await supabaseAdmin
        .from("courses")
        .insert({
          title: courseInfo.title,
          discipline: courseInfo.discipline,
          grade: courseInfo.grade,
        })
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: error.message, details: error }, { status: 500 });
      }
      courseId = newCourse.id;
    }

    // Import lessons
    const results = { success: 0, errors: 0, errorMessages: [] as string[], missingImages: [] as string[] };

    for (let i = 0; i < csvData.length; i++) {
      const row = csvData[i];
      const lessonData: Record<string, any> = {
        course_id: courseId,
        lesson_number: parseInt(row["Lesson Number"]) || i + 1,
        title: row.LessonName || `Lesson ${i + 1}`,
        total_time: row["Total Time"] || null,
      };

      for (const [csvField, dbField] of Object.entries(fieldMappings)) {
        if (row[csvField]) {
          const sanitized = sanitizeHtml(row[csvField], {
            allowedTags: [...sanitizeHtml.defaults.allowedTags, "img"],
            allowedAttributes: {
              ...sanitizeHtml.defaults.allowedAttributes,
              img: ["src", "alt", "title", "width", "height"],
              "*": ["style", "class"],
            },
          });
          const transformed = transformHtml(sanitized);
          const { html: htmlWithUrls, missingImages } = transformImageUrls(transformed, courseId!);
          lessonData[dbField] = htmlWithUrls;
          if (missingImages.length > 0) {
            results.missingImages.push(...missingImages);
          }
        }
      }

      const { error } = await supabaseAdmin
        .from("lessons")
        .upsert(lessonData, {
          onConflict: 'course_id,lesson_number',
          ignoreDuplicates: false
        });

      if (error) {
        results.errors++;
        results.errorMessages.push(`Lesson ${i + 1}: ${error.message}`);
      } else {
        results.success++;
      }
    }

    return NextResponse.json({ success: true, courseId, results, isReimport: !!existingCourse });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}