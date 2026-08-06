import { createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const supabaseAdmin = await createServiceClient();
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get("days") || "7", 10);
    const sortBy = searchParams.get("sort") || "days_active_last_7";
    const sortOrder = searchParams.get("order") || "desc";
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    const now = new Date();
    const startDate7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const startDate30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    // Get all teachers (exclude admins)
    const { data: teachers, error: teachersError } = await supabaseAdmin
      .from("profiles")
      .select("id, first_name, last_name, email, role, enrollment_status, created_at")
      .eq("role", "teacher")
      .order("last_name", { ascending: true });

    if (teachersError) {
      return NextResponse.json({ error: teachersError.message }, { status: 500 });
    }

    if (!teachers || teachers.length === 0) {
      return NextResponse.json({
        summary: {
          totalTeachers: 0,
          activeLast7Days: 0,
          activeLast30Days: 0,
          avgDaysActivePerWeek: 0,
          dailyActiveRate: 0,
          mostActiveDay: "N/A",
        },
        teachers: [],
        pagination: {
          total: 0,
          limit,
          offset,
          hasMore: false,
        },
      });
    }

    const teacherIds = teachers.map((t) => t.id);

    // Get activity data for all teachers in date range
    const { data: activities, error: activityError } = await supabaseAdmin
      .from("user_activity_log")
      .select("user_id, action, resource_id, created_at")
      .in("user_id", teacherIds)
      .gte("created_at", startDate30.toISOString())
      .order("created_at", { ascending: false });

    if (activityError) {
      return NextResponse.json({ error: activityError.message }, { status: 500 });
    }

    // Calculate metrics for each teacher
    const teacherMetrics = teachers.map((teacher) => {
      const teacherActivities7 = activities?.filter(
        (a) => a.user_id === teacher.id && new Date(a.created_at) >= startDate7
      ) || [];
      const teacherActivities30 = activities?.filter(
        (a) => a.user_id === teacher.id && new Date(a.created_at) >= startDate30
      ) || [];
      const teacherActivitiesAll = activities?.filter((a) => a.user_id === teacher.id) || [];

      // Unique days active in last 7 days
      const uniqueDays7 = new Set(
        teacherActivities7.map((a) => new Date(a.created_at).toISOString().split("T")[0])
      );

      // Unique days active in last 30 days
      const uniqueDays30 = new Set(
        teacherActivities30.map((a) => new Date(a.created_at).toISOString().split("T")[0])
      );

      // Action counts last 7 days
      const logins7 = teacherActivities7.filter((a) => a.action === "login").length;
      const lessonsViewed7 = teacherActivities7.filter((a) => a.action === "view_lesson").length;
      const coursesViewed7 = teacherActivities7.filter((a) => a.action === "view_course").length;

      // Action counts last 30 days
      const logins30 = teacherActivities30.filter((a) => a.action === "login").length;
      const lessonsViewed30 = teacherActivities30.filter((a) => a.action === "view_lesson").length;
      const coursesViewed30 = teacherActivities30.filter((a) => a.action === "view_course").length;

      // Total actions
      const totalActions7 = logins7 + lessonsViewed7 + coursesViewed7;
      const totalActions30 = logins30 + lessonsViewed30 + coursesViewed30;

      // Last activity
      const lastActivity = teacherActivitiesAll[0]?.created_at || null;

      // Is daily active (had activity today)
      const today = new Date().toISOString().split("T")[0];
      const isDailyActive = Array.from(uniqueDays7).includes(today);

      // Is weekly active (active at least 4 days per week)
      const isWeeklyActive = uniqueDays7.size >= 4;

      return {
        id: teacher.id,
        name: `${teacher.first_name || ""} ${teacher.last_name || ""}`.trim() || teacher.email,
        email: teacher.email,
        role: teacher.role,
        enrollment_status: teacher.enrollment_status,
        days_active_last_7: uniqueDays7.size,
        days_active_last_30: uniqueDays30.size,
        logins_7d: logins7,
        logins_30d: logins30,
        lessons_viewed_7d: lessonsViewed7,
        lessons_viewed_30d: lessonsViewed30,
        courses_viewed_7d: coursesViewed7,
        courses_viewed_30d: coursesViewed30,
        total_actions_7d: totalActions7,
        total_actions_30d: totalActions30,
        last_active: lastActivity,
        is_daily_active: isDailyActive,
        is_weekly_active: isWeeklyActive,
      };
    });

    // Sort teachers
    const sortColumn = sortBy || "days_active_last_7";
    teacherMetrics.sort((a, b) => {
      const aVal = a[sortColumn as keyof typeof a];
      const bVal = b[sortColumn as keyof typeof b];
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;
      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortOrder === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortOrder === "asc" ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });

    // Paginate
    const paginatedTeachers = teacherMetrics.slice(offset, offset + limit);
    const totalActive7 = teacherMetrics.filter((t) => t.days_active_last_7 > 0).length;
    const totalActive30 = teacherMetrics.filter((t) => t.days_active_last_30 > 0).length;

    // Calculate average days active per week (for active teachers in last 7 days)
    const activeTeachers7 = teacherMetrics.filter((t) => t.days_active_last_7 > 0);
    const avgDaysActivePerWeek = activeTeachers7.length > 0
      ? activeTeachers7.reduce((sum, t) => sum + t.days_active_last_7, 0) / activeTeachers7.length
      : 0;

    // Daily active rate (% of teachers active today)
    const dailyActiveRate = teacherMetrics.length > 0
      ? teacherMetrics.filter((t) => t.is_daily_active).length / teacherMetrics.length
      : 0;

    // Most active day of week (aggregate across all teachers)
    const dayCounts: Record<string, number> = { Sunday: 0, Monday: 0, Tuesday: 0, Wednesday: 0, Thursday: 0, Friday: 0, Saturday: 0 };
    activities?.forEach((a) => {
      const day = new Date(a.created_at).toLocaleDateString("en-US", { weekday: "long" });
      if (dayCounts[day] !== undefined) {
        dayCounts[day]++;
      }
    });
    const mostActiveDay = Object.entries(dayCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "N/A";

    return NextResponse.json({
      summary: {
        totalTeachers: teacherMetrics.length,
        activeLast7Days: totalActive7,
        activeLast30Days: totalActive30,
        avgDaysActivePerWeek: Math.round(avgDaysActivePerWeek * 10) / 10,
        dailyActiveRate: Math.round(dailyActiveRate * 100),
        mostActiveDay,
      },
      teachers: paginatedTeachers,
      pagination: {
        total: teacherMetrics.length,
        limit,
        offset,
        hasMore: offset + limit < teacherMetrics.length,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
