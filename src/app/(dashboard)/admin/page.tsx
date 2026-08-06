import { createClient, createServiceClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth-helpers";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function AdminDashboard() {
  await requireAdmin();
  
  const supabase = await createServiceClient();

  const { data: courses } = await supabase
    .from("courses")
    .select("*, lessons(count)")
    .order("created_at", { ascending: false });

  const { data: teachers } = await supabase
    .from("profiles")
    .select("*")
    .eq("role", "teacher");

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h2 className="text-2xl font-bold">Admin Dashboard</h2>
        <p className="text-gray-600">Manage courses, lessons, and teachers</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle>{courses?.length || 0}</CardTitle>
            <CardDescription>Total Courses</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>
              {courses?.reduce((acc, c) => acc + (c.lessons?.[0]?.count || 0), 0) || 0}
            </CardTitle>
            <CardDescription>Total Lessons</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{teachers?.length || 0}</CardTitle>
            <CardDescription>Teachers</CardDescription>
          </CardHeader>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Courses</CardTitle>
            <CardDescription>Manage curriculum courses</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <Link href="/admin/courses">
                <Button>All Courses</Button>
              </Link>
              <Link href="/admin/import">
                <Button variant="outline">Import CSV</Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Teachers</CardTitle>
            <CardDescription>Manage teacher accounts and assignments</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/admin/teachers">
              <Button variant="outline">Manage Teachers</Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Analytics</CardTitle>
            <CardDescription>View teacher activity and engagement</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/admin/analytics">
              <Button variant="outline">Teacher Activity</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
