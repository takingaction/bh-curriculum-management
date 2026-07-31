import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export async function POST() {
  try {
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

    // Clear all stuck jobs (status = 'processing') and their results
    const { data: stuckJobs } = await supabaseAdmin
      .from("batch_pdf_jobs")
      .select("id")
      .eq("status", "processing");

    if (stuckJobs && stuckJobs.length > 0) {
      const stuckJobIds = stuckJobs.map(j => j.id);
      
      // Delete results first
      await supabaseAdmin
        .from("batch_pdf_results")
        .delete()
        .in("job_id", stuckJobIds);
      
      // Delete the jobs
      await supabaseAdmin
        .from("batch_pdf_jobs")
        .delete()
        .in("id", stuckJobIds);

      console.log(`Cleared ${stuckJobs.length} stuck job(s)`);
    }

    return NextResponse.json({
      success: true,
      clearedCount: stuckJobs?.length || 0,
    });

  } catch (error: any) {
    console.error("Clear stuck jobs error:", error);
    return NextResponse.json({ error: error.message || "Failed" }, { status: 500 });
  }
}
