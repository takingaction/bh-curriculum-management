import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export async function GET() {
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

    // First try to find a processing job
    const { data: processingJob } = await supabaseAdmin
      .from("batch_pdf_jobs")
      .select("*")
      .eq("status", "processing")
      .single();

    if (processingJob) {
      return NextResponse.json({ job: processingJob, isRunning: true });
    }

    // Otherwise return the most recent job
    const { data: recentJob } = await supabaseAdmin
      .from("batch_pdf_jobs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    return NextResponse.json({
      job: recentJob || null,
      isRunning: false,
    });

  } catch (error: any) {
    console.error("Batch current error:", error);
    return NextResponse.json({ error: error.message || "Failed" }, { status: 500 });
  }
}
