import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default async function AdminCoursesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const query = params.q || "";

  let coursesQuery = supabase
    .from("courses")
    .select("*, lessons(count)")
    .order("created_at", { ascending: false });

  if (query) {
    coursesQuery = coursesQuery.ilike("title", `%${query}%`);
  }

  const { data: courses } = await coursesQuery;

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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {courses?.map((course) => (
          <Card key={course.id}>
            <CardHeader>
              <CardTitle className="text-lg">{course.title}</CardTitle>
              <p className="text-sm text-gray-500">
                {course.discipline} · Grade {course.grade}
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
