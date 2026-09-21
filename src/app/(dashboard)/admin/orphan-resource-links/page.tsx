import { requireAdmin } from "@/lib/auth-helpers";
import { createServiceClient } from "@/lib/supabase/server";
import {
  detectOrphanLinks,
  ORPHAN_CONTENT_FIELDS,
  type AssetInput,
  type LessonInput,
} from "@/lib/orphan-detection";
import OrphanResourceLinksClient from "./page-client";

export const dynamic = "force-dynamic";

export default async function OrphanResourceLinksPage() {
  await requireAdmin();

  const supabaseAdmin = await createServiceClient();

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
      if (error) break;
      if (!data || data.length === 0) break;
      all.push(...(data as T[]));
      if (data.length < PAGE) break;
      from += PAGE;
    }
    return all;
  };

  const [assetsRaw, lessonsRaw] = await Promise.all([
    fetchAll<AssetInput>("assets", "id, public_url, filename, display_name, previous_public_urls"),
    fetchAll<LessonInput>("lessons", `id, title, course_id, ${ORPHAN_CONTENT_FIELDS.join(", ")}`),
  ]);

  const initialReport = detectOrphanLinks(lessonsRaw, assetsRaw);

  return <OrphanResourceLinksClient initialReport={initialReport} />;
}
