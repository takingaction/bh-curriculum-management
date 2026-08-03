import { requireAdmin } from "@/lib/auth-helpers";
import EditTeacherClientPage from "./page-client";

export default async function EditTeacherPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  return <EditTeacherClientPage params={params} />;
}
