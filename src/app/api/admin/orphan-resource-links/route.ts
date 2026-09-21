import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import {
  detectOrphanLinks,
  ORPHAN_CONTENT_FIELDS,
  type AssetInput,
  type LessonInput,
} from "@/lib/orphan-detection";

export async function POST() {
  try {
    const supabase = await createClient();
    const supabaseAdmin = await createServiceClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError || profile?.role !== "admin") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const selectFields = `id, public_url, filename, display_name, previous_public_urls`;

    const fetchAll = async <T,>(
      table: "assets" | "lessons",
      columns: string
    ): Promise<T[]> => {
      const all: T[] = [];
      const PAGE = 1000;
      let from = 0;
      while (true) {
        const { data, error } = await supabaseAdmin
          .from(table)
          .select(columns)
          .range(from, from + PAGE - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        all.push(...(data as T[]));
        if (data.length < PAGE) break;
        from += PAGE;
      }
      return all;
    };

    const [assetsRaw, lessonsRaw] = await Promise.all([
      fetchAll<AssetInput>("assets", selectFields),
      fetchAll<LessonInput>("lessons", `id, title, course_id, ${ORPHAN_CONTENT_FIELDS.join(", ")}`),
    ]);

    const report = detectOrphanLinks(lessonsRaw, assetsRaw);

    return NextResponse.json(report);
  } catch (error: unknown) {
    console.error("Orphan detection error:", error);
    const message = error instanceof Error ? error.message : "An unexpected error occurred";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
