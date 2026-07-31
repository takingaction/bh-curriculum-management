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
      .from("batch_pdf_jobs")
      .select("*")
      .eq("id", jobId)
      .single();

    if (jobError || !job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    // Get pending results (lessons not yet processed)
    const { data: pendingResults, error: pendingError } = await supabaseAdmin
      .from("batch_pdf_results")
      .select(`
        id,
        lesson_id,
        status,
        retry_count,
        processed_at
      `)
      .eq("job_id", jobId)
      .eq("status", "pending")
      .order("processed_at", { ascending: true });

    if (pendingError) {
      console.error("Error fetching pending results:", pendingError);
      return NextResponse.json({ error: "Failed to fetch pending lessons" }, { status: 500 });
    }

    // Get lesson details for pending items
    const pendingLessonIds = (pendingResults || []).map(r => r.lesson_id);
    
    let lessonsMap: Record<string, any> = {};
    if (pendingLessonIds.length > 0) {
      const { data: lessons } = await supabaseAdmin
        .from("lessons")
        .select("id, lesson_number, title, course_id")
        .in("id", pendingLessonIds);
      
      if (lessons) {
        lessonsMap = Object.fromEntries(lessons.map(l => [l.id, l]));
      }
    }

    // Build pending lessons with lesson details
    const pendingLessons = pendingResults?.map(r => ({
      id: r.id,
      lesson_id: r.lesson_id,
      status: r.status,
      retry_count: r.retry_count,
      processed_at: r.processed_at,
      lesson: lessonsMap[r.lesson_id] || null,
    })) || [];

    return NextResponse.json({
      jobId,
      pendingCount: pendingLessons.length,
      pendingLessons,
    });

  } catch (error: any) {
    console.error("Batch pending error:", error);
    return NextResponse.json({ error: error.message || "Failed" }, { status: 500 });
  }
}
