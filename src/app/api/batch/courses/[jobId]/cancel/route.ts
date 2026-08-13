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

    // Update job status to cancelled
    const { data: job, error: updateError } = await supabaseAdmin
      .from("batch_course_pdf_jobs")
      .update({
        status: "cancelled",
        completed_at: new Date().toISOString(),
      })
      .eq("id", jobId)
      .select()
      .single();

    if (updateError) {
      console.error("Error cancelling job:", updateError);
      return NextResponse.json({ error: "Failed to cancel job" }, { status: 500 });
    }

    return NextResponse.json({ success: true, job });

  } catch (error: any) {
    console.error("Cancel job error:", error);
    return NextResponse.json({ error: error.message || "Failed" }, { status: 500 });
  }
}
