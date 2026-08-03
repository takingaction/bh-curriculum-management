import { requireAdmin } from "@/lib/auth-helpers";
import EditLessonClientPage from "./page-client";

export default async function EditLessonPage({
  params,
}: {
  params: Promise<{ id: string; lessonId: string }>;
}) {
  await requireAdmin();
  return <EditLessonClientPage params={params} />;
}
