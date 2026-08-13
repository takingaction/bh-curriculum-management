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

    // Get actual counts from results table
    const { count: successCount } = await supabaseAdmin
      .from("batch_course_pdf_results")
      .select("*", { count: "exact", head: true })
      .eq("job_id", jobId)
      .eq("status", "success");

    const { count: failedCount } = await supabaseAdmin
      .from("batch_course_pdf_results")
      .select("*", { count: "exact", head: true })
      .eq("job_id", jobId)
      .eq("status", "failed");

    const { count: pendingCount } = await supabaseAdmin
      .from("batch_course_pdf_results")
      .select("*", { count: "exact", head: true })
      .eq("job_id", jobId)
      .eq("status", "pending");

    const totalCount = (successCount || 0) + (failedCount || 0) + (pendingCount || 0);
    const processedCount = (successCount || 0) + (failedCount || 0);

    // Update job with correct counters
    const { error: updateError } = await supabaseAdmin
      .from("batch_course_pdf_jobs")
      .update({
        success_count: successCount || 0,
        failure_count: failedCount || 0,
        processed_count: processedCount,
        total_count: totalCount,
        status: processedCount >= totalCount && totalCount > 0 ? "completed" : "processing",
        completed_at: processedCount >= totalCount && totalCount > 0 ? new Date().toISOString() : null,
      })
      .eq("id", jobId);

    if (updateError) {
      console.error("Error updating job counters:", updateError);
      return NextResponse.json({ error: "Failed to sync counters" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      counters: {
        success: successCount || 0,
        failed: failedCount || 0,
        pending: pendingCount || 0,
        processed: processedCount,
        total: totalCount,
      },
    });

  } catch (error: any) {
    console.error("Batch sync-counters error:", error);
    return NextResponse.json({ error: error.message || "Failed" }, { status: 500 });
  }
}
