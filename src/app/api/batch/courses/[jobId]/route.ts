import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = parseInt(searchParams.get("pageSize") || "20", 10);
    const statusFilter = searchParams.get("status");

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

    // Calculate offset
    const offset = (page - 1) * pageSize;

    // Build query for results
    let resultsQuery = supabaseAdmin
      .from("batch_course_pdf_results")
      .select("*")
      .eq("job_id", jobId)
      .order("processed_at", { ascending: false });

    if (statusFilter === "success") {
      resultsQuery = resultsQuery.eq("status", "success");
    } else if (statusFilter === "failed") {
      resultsQuery = resultsQuery.eq("status", "failed");
    }

    // Get total count for this job
    const { count: totalCount } = await supabaseAdmin
      .from("batch_course_pdf_results")
      .select("*", { count: "exact", head: true })
      .eq("job_id", jobId);

    // Get paginated results
    const { data: results, error: resultsError } = await resultsQuery
      .range(offset, offset + pageSize - 1);

    if (resultsError) {
      console.error("Error fetching results:", resultsError);
      return NextResponse.json({ error: "Failed to fetch results" }, { status: 500 });
    }

    // Get unique course IDs
    const courseIds = [...new Set((results || []).map(r => r.course_id).filter(Boolean))];

    // Fetch course data
    let coursesMap: Record<string, any> = {};
    if (courseIds.length > 0) {
      const { data: courses } = await supabaseAdmin
        .from("courses")
        .select("id, title, discipline, grade")
        .in("id", courseIds);

      if (courses) {
        coursesMap = Object.fromEntries(courses.map(c => [c.id, c]));
      }
    }

    // Fetch file sizes from course_pdfs
    let fileSizesMap: Record<string, number | null> = {};
    if (courseIds.length > 0) {
      const { data: pdfData } = await supabaseAdmin
        .from("course_pdfs")
        .select("course_id, file_size")
        .in("course_id", courseIds);

      if (pdfData) {
        fileSizesMap = Object.fromEntries(pdfData.map(p => [p.course_id, p.file_size]));
      }
    }

    // Combine data
    const resultsWithCourse = (results || []).map(r => ({
      ...r,
      course: r.course_id ? {
        id: r.course_id,
        title: coursesMap[r.course_id]?.title || null,
        discipline: coursesMap[r.course_id]?.discipline || null,
        grade: coursesMap[r.course_id]?.grade || null,
        file_size: fileSizesMap[r.course_id] || null,
      } : null,
    }));

    return NextResponse.json({
      job,
      results: resultsWithCourse,
      pagination: {
        page,
        pageSize,
        totalCount: totalCount || 0,
        totalPages: Math.ceil((totalCount || 0) / pageSize),
      },
    });

  } catch (error: any) {
    console.error("Batch job error:", error);
    return NextResponse.json({ error: error.message || "Failed" }, { status: 500 });
  }
}
