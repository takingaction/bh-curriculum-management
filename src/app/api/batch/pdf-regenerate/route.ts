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

    // Check if there's already a job running
    const { data: runningJob } = await supabaseAdmin
      .from("batch_pdf_jobs")
      .select("id")
      .eq("status", "processing")
      .single();

    if (runningJob) {
      return NextResponse.json(
        { error: "A batch is already in progress", jobId: runningJob.id },
        { status: 409 }
      );
    }

    // Get all lesson IDs
    const { data: lessons, error: lessonsError } = await supabaseAdmin
      .from("lessons")
      .select("id");

    if (lessonsError) {
      console.error("Error fetching lessons:", lessonsError);
      return NextResponse.json({ error: "Failed to fetch lessons" }, { status: 500 });
    }

    const lessonIds = lessons?.map(l => l.id) || [];

    // Delete old jobs (keep none - we'll create fresh)
    const { error: deleteOldError } = await supabaseAdmin
      .from("batch_pdf_jobs")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000"); // Delete all (this is a temp solution)

    if (deleteOldError) {
      console.error("Error deleting old jobs:", deleteOldError);
    }

    // Create new batch job
    const { data: job, error: jobError } = await supabaseAdmin
      .from("batch_pdf_jobs")
      .insert({
        status: "processing",
        total_count: lessonIds.length,
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

    // Create result records for each lesson (all pending initially)
    const resultRecords = lessonIds.map(lessonId => ({
      job_id: job.id,
      lesson_id: lessonId,
      status: "pending",
      retry_count: 0,
    }));

    const { error: resultsError } = await supabaseAdmin
      .from("batch_pdf_results")
      .insert(resultRecords);

    if (resultsError) {
      console.error("Error creating result records:", resultsError);
      // Continue anyway - we can still process
    }

    return NextResponse.json({
      jobId: job.id,
      totalCount: lessonIds.length,
    });

  } catch (error: any) {
    console.error("Batch PDF regenerate error:", error);
    return NextResponse.json({ error: error.message || "Failed" }, { status: 500 });
  }
}
