import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;
    const { searchParams } = new URL(request.url);
    const retry = searchParams.get("retry") === "true";

    const body = await request.json();
    const { lessonId, status, errorMessage } = body;

    if (!lessonId || !status) {
      return NextResponse.json(
        { error: "lessonId and status are required" },
        { status: 400 }
      );
    }

    if (!["success", "failed", "pending"].includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

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

    // Get current result record
    const { data: existingResult } = await supabaseAdmin
      .from("batch_pdf_results")
      .select("*")
      .eq("job_id", jobId)
      .eq("lesson_id", lessonId)
      .single();

    if (!existingResult) {
      return NextResponse.json({ error: "Result record not found" }, { status: 404 });
    }

    // Check if we should retry
    if (retry && status === "failed" && existingResult.retry_count < 1) {
      // Update retry count but keep as pending
      await supabaseAdmin
        .from("batch_pdf_results")
        .update({
          retry_count: existingResult.retry_count + 1,
          status: "pending",
        })
        .eq("id", existingResult.id);

      return NextResponse.json({
        shouldRetry: true,
        message: "Will retry",
      });
    }

    // Update result record
    await supabaseAdmin
      .from("batch_pdf_results")
      .update({
        status,
        error_message: errorMessage || null,
        processed_at: new Date().toISOString(),
      })
      .eq("id", existingResult.id);

    // Update job progress counters
    if (status === "success" || status === "failed") {
      const incrementSuccess = status === "success" ? 1 : 0;
      const incrementFailure = status === "failed" ? 1 : 0;

      // Update job counters
      const { data: job } = await supabaseAdmin
        .from("batch_pdf_jobs")
        .select("processed_count, success_count, failure_count, total_count")
        .eq("id", jobId)
        .single();

      if (job) {
        const newProcessedCount = job.processed_count + 1;
        const newSuccessCount = job.success_count + incrementSuccess;
        const newFailureCount = job.failure_count + incrementFailure;
        const isComplete = newProcessedCount >= job.total_count;

        await supabaseAdmin
          .from("batch_pdf_jobs")
          .update({
            processed_count: newProcessedCount,
            success_count: newSuccessCount,
            failure_count: newFailureCount,
            status: isComplete ? "completed" : "processing",
            completed_at: isComplete ? new Date().toISOString() : null,
          })
          .eq("id", jobId);
      }
    }

    return NextResponse.json({
      success: true,
      status,
      retryCount: existingResult.retry_count,
    });

  } catch (error: any) {
    console.error("Batch result error:", error);
    return NextResponse.json({ error: error.message || "Failed" }, { status: 500 });
  }
}
