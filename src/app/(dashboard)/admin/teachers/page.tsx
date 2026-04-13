import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default async function TeachersPage() {
  const supabase = await createClient();

  const { data: teachers } = await supabase
    .from("profiles")
    .select("*, teacher_assignments(count)")
    .eq("role", "teacher");

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h2 className="text-2xl font-bold">Teachers</h2>
        <p className="text-gray-600">Manage teacher accounts and course assignments</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Teachers ({teachers?.length || 0})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Assigned Courses</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {teachers?.map((teacher) => (
                <TableRow key={teacher.id}>
                  <TableCell>{teacher.full_name || "-"}</TableCell>
                  <TableCell>{teacher.email}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{teacher.role}</Badge>
                  </TableCell>
                  <TableCell>{teacher.teacher_assignments?.[0]?.count || 0}</TableCell>
                  <TableCell>
                    <TeacherActions teacherId={teacher.id} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function TeacherActions({ teacherId }: { teacherId: string }) {
  return (
    <div className="flex gap-2">
      <form
        action={async () => {
          "use server";
          const supabase = await createClient();
          // TODO: Show assignment modal
          console.log("Assign courses to teacher:", teacherId);
        }}
      >
        <Button variant="outline" size="sm">
          Assign Courses
        </Button>
      </form>
    </div>
  );
}
