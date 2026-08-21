import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: failures, error } = await supabase
    .from("translation_failures")
    .select(`
      *,
      profiles:user_id (email),
      lessons:lesson_id (title)
    `)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error("Error fetching translation failures:", error);
    return NextResponse.json({ error: "Failed to fetch failures" }, { status: 500 });
  }

  const formattedFailures = (failures || []).map((f: any) => ({
    ...f,
    user_email: f.profiles?.email || null,
    lesson_title: f.lessons?.title || null,
  }));

  return NextResponse.json({ failures: formattedFailures });
}
