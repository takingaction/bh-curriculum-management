import { createServiceClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const gradeOrder = ["PK", "K", "1", "2", "3", "4", "5", "6"];

function sortByGrade(a: { grade: string }, b: { grade: string }) {
  const aIndex = gradeOrder.indexOf(a.grade);
  const bIndex = gradeOrder.indexOf(b.grade);
  if (aIndex === -1 && bIndex === -1) return a.grade.localeCompare(b.grade);
  if (aIndex === -1) return 1;
  if (bIndex === -1) return -1;
  return aIndex - bIndex;
}

export default async function AdminCoursesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createServiceClient();
  const query = params.q || "";

  let coursesQuery = supabase
    .from("courses")
    .select("*, lessons(count)")
    .order("discipline", { ascending: true })
    .order("grade", { ascending: true });

  if (query) {
    coursesQuery = coursesQuery.ilike("title", `%${query}%`);
  }

  const { data: courses } = await coursesQuery;

  const groupedCourses = courses?.reduce((acc, course) => {
    const discipline = course.discipline || "Other";
    if (!acc[discipline]) acc[discipline] = [];
    acc[discipline].push(course);
    return acc;
  }, {} as Record<string, { id: string; title: string; discipline: string; grade: string; lessons?: { count: number }[] }[]>);

  const disciplines = ["Music", "Dance", "Theatre"].filter(d => groupedCourses?.[d]?.length);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-2xl font-bold">Courses</h2>
          <p className="text-gray-600">Manage curriculum courses</p>
        </div>
        <Link href="/admin/courses/new">
          <Button>Add Course</Button>
        </Link>
      </div>

      <div className="mb-6">
        <form method="get">
          <Input
            name="q"
            placeholder="Search courses..."
            defaultValue={query}
            className="max-w-md"
          />
        </form>
      </div>

      {disciplines.map((discipline) => {
            const sortedCourses = [...groupedCourses![discipline]].sort(sortByGrade);
            return (
              <div key={discipline} className="mb-8">
                <h3 className="text-xl font-bold mb-4 text-[#0d7377]">{discipline}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {sortedCourses.map((course) => (
                    <Card key={course.id}>
                      <CardHeader>
                        <CardTitle className="text-lg">{course.title}</CardTitle>
                        <p className="text-sm text-gray-500">
                          Grade {course.grade}
                        </p>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-gray-600 mb-4">
                          {course.lessons?.[0]?.count || 0} lessons
                        </p>
                        <div className="flex gap-2">
                          <Link href={`/admin/courses/${course.id}`}>
                            <Button variant="outline" size="sm">Manage</Button>
                          </Link>
                          <Link href={`/admin/courses/${course.id}/lessons/new`}>
                            <Button variant="outline" size="sm">Add Lesson</Button>
                          </Link>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            );
          })}

      {courses?.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500 mb-4">No courses found</p>
          <Link href="/admin/import">
            <Button variant="outline">Import from CSV</Button>
          </Link>
        </div>
      )}
    </div>
  );
}
