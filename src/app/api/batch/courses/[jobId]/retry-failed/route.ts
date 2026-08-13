import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export async function POST(
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

    // Get all failed results for this job
    const { data: failedResults, error: failedError } = await supabaseAdmin
      .from("batch_course_pdf_results")
      .select("id, course_id")
      .eq("job_id", jobId)
      .eq("status", "failed");

    if (failedError) {
      console.error("Error fetching failed results:", failedError);
      return NextResponse.json({ error: "Failed to fetch failed results" }, { status: 500 });
    }

    if (!failedResults || failedResults.length === 0) {
      return NextResponse.json({ message: "No failed results to retry", count: 0 });
    }

    // Reset each failed result to pending
    const courseIds = failedResults.map(r => r.course_id);
    const { error: updateError } = await supabaseAdmin
      .from("batch_course_pdf_results")
      .update({
        status: "pending",
        error_message: null,
        retry_count: 0,
        processed_at: new Date().toISOString(),
      })
      .eq("job_id", jobId)
      .in("course_id", courseIds);

    if (updateError) {
      console.error("Error updating results:", updateError);
      return NextResponse.json({ error: "Failed to reset results" }, { status: 500 });
    }

    // Update job counters: decrement failure_count and processed_count
    const { data: job } = await supabaseAdmin
      .from("batch_course_pdf_jobs")
      .select("processed_count, failure_count")
      .eq("id", jobId)
      .single();

    if (job) {
      const newFailureCount = Math.max(0, job.failure_count - failedResults.length);
      const newProcessedCount = Math.max(0, job.processed_count - failedResults.length);

      await supabaseAdmin
        .from("batch_course_pdf_jobs")
        .update({
          failure_count: newFailureCount,
          processed_count: newProcessedCount,
        })
        .eq("id", jobId);
    }

    return NextResponse.json({
      success: true,
      count: failedResults.length,
      message: `Reset ${failedResults.length} failed results to pending`,
    });

  } catch (error: any) {
    console.error("Batch retry-failed error:", error);
    return NextResponse.json({ error: error.message || "Failed" }, { status: 500 });
  }
}
