import { createClient, createServiceClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";

export default async function AssignAllCoursesPage() {
  const supabase = await createClient();
  const supabaseAdmin = await createServiceClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: courses } = await supabaseAdmin
    .from("courses")
    .select("id");

  let assignedCount = 0;
  const error = "";

  if (courses && courses.length > 0) {
    for (const course of courses) {
      const { error: insertError } = await supabaseAdmin
        .from("teacher_assignments")
        .upsert(
          { teacher_id: user.id, course_id: course.id },
          { onConflict: "teacher_id,course_id", ignoreDuplicates: true }
        );

      if (!insertError) {
        assignedCount++;
      }
    }
  }

  return (
    <div className="max-w-md mx-auto mt-20 p-8 bg-white rounded-lg shadow">
      <h1 className="text-xl font-bold text-[#2d2d2d] mb-4">Assign All Courses</h1>

      {error && !assignedCount ? (
        <div className="text-red-500 mb-4">{error}</div>
      ) : (
        <p className="text-[#666666] mb-4">
          Successfully assigned {assignedCount} courses to your account.
        </p>
      )}

      <a href="/admin/courses">
        <Button className="bg-[#0d7377] hover:bg-[#0a5c5f] text-white">
          Go to Courses
        </Button>
      </a>
    </div>
  );
}
