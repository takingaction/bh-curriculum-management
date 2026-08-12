import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getWeekStart, formatWeekStart } from "@/lib/version-utils";

const WEEKLY_PDF_LIMIT = 20;

export async function GET() {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = user.id;
    const weekStart = getWeekStart();
    const weekStartStr = formatWeekStart(weekStart);

    const { data: pdfUsage, error } = await supabase
      .from("lesson_version_pdf_usage")
      .select("pdf_count")
      .eq("user_id", userId)
      .eq("week_start", weekStartStr)
      .single();

    if (error && error.code !== "PGRST116") {
      console.error("Error fetching PDF usage:", error);
      return NextResponse.json({ error: "Failed to fetch PDF usage" }, { status: 500 });
    }

    const currentCount = pdfUsage?.pdf_count || 0;

    return NextResponse.json({
      pdf_count: currentCount,
      limit: WEEKLY_PDF_LIMIT,
      remaining: WEEKLY_PDF_LIMIT - currentCount,
      week_start: weekStartStr,
    });
  } catch (error: any) {
    console.error("PDF usage error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
