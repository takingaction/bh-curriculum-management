import { requireAdmin } from "@/lib/auth-helpers";
import NewLessonClientPage from "./page-client";

export default async function NewLessonPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  return <NewLessonClientPage params={params} />;
}
