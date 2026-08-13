import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;

    const supabase = await createClient();

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is admin
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError || profile?.role !== "admin") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const supabaseAdmin = await createServiceClient();

    // Get the job
    const { data: job, error: jobError } = await supabaseAdmin
      .from("batch_course_pdf_jobs")
      .select("*")
      .eq("id", jobId)
      .single();

    if (jobError || !job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    // Get pending results (courses not yet processed)
    const { data: pendingResults, error: pendingError } = await supabaseAdmin
      .from("batch_course_pdf_results")
      .select(`
        id,
        course_id,
        status,
        retry_count,
        processed_at
      `)
      .eq("job_id", jobId)
      .eq("status", "pending")
      .order("processed_at", { ascending: true });

    if (pendingError) {
      console.error("Error fetching pending results:", pendingError);
      return NextResponse.json({ error: "Failed to fetch pending courses" }, { status: 500 });
    }

    // Get course details for pending items
    const pendingCourseIds = (pendingResults || []).map(r => r.course_id);

    let coursesMap: Record<string, any> = {};
    if (pendingCourseIds.length > 0) {
      const { data: courses } = await supabaseAdmin
        .from("courses")
        .select("id, title, discipline, grade")
        .in("id", pendingCourseIds);

      if (courses) {
        coursesMap = Object.fromEntries(courses.map(c => [c.id, c]));
      }
    }

    // Build pending courses with course details
    const pendingCourses = pendingResults?.map(r => ({
      id: r.id,
      course_id: r.course_id,
      status: r.status,
      retry_count: r.retry_count,
      processed_at: r.processed_at,
      course: coursesMap[r.course_id] || null,
    })) || [];

    return NextResponse.json({
      jobId,
      pendingCount: pendingCourses.length,
      pendingCourses,
    });

  } catch (error: any) {
    console.error("Batch pending error:", error);
    return NextResponse.json({ error: error.message || "Failed" }, { status: 500 });
  }
}
