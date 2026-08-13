import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export async function POST() {
  try {
    const supabase = await createClient();
    const supabaseAdmin = await createServiceClient();

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

    // Clear any stuck/cancelled/processing jobs from previous attempts first
    const { error: clearError } = await supabaseAdmin
      .from("batch_course_pdf_jobs")
      .update({ status: "cancelled", completed_at: new Date().toISOString() })
      .in("status", ["processing", "cancelled"]);

    if (clearError) {
      console.error("Error clearing old jobs:", clearError);
    }

    // Delete old batch results from previous batches (starting fresh with new batch)
    await supabaseAdmin
      .from("batch_course_pdf_results")
      .delete();

    // Get all course IDs
    const { data: courses, error: coursesError } = await supabaseAdmin
      .from("courses")
      .select("id");

    if (coursesError) {
      console.error("Error fetching courses:", coursesError);
      return NextResponse.json({ error: "Failed to fetch courses" }, { status: 500 });
    }

    const courseIds = courses?.map(c => c.id) || [];

    // Create new batch job
    const { data: job, error: jobError } = await supabaseAdmin
      .from("batch_course_pdf_jobs")
      .insert({
        status: "processing",
        total_count: courseIds.length,
        processed_count: 0,
        success_count: 0,
        failure_count: 0,
        created_by: user.id,
      })
      .select()
      .single();

    if (jobError || !job) {
      console.error("Error creating job:", jobError);
      return NextResponse.json({ error: "Failed to create batch job" }, { status: 500 });
    }

    // Create result records for each course (all pending initially)
    const resultRecords = courseIds.map(courseId => ({
      job_id: job.id,
      course_id: courseId,
      status: "pending",
      retry_count: 0,
    }));

    const { error: resultsError } = await supabaseAdmin
      .from("batch_course_pdf_results")
      .insert(resultRecords);

    if (resultsError) {
      console.error("Error creating result records:", resultsError);
      // Continue anyway - we can still process
    }

    return NextResponse.json({
      jobId: job.id,
      totalCount: courseIds.length,
    });

  } catch (error: any) {
    console.error("Batch Course PDF regenerate error:", error);
    return NextResponse.json({ error: error.message || "Failed" }, { status: 500 });
  }
}
