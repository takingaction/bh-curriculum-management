import { requireAdmin } from "@/lib/auth-helpers";
import TeacherAnalyticsClientPage from "./page-client";

export default async function TeacherAnalyticsPage() {
  await requireAdmin();
  return <TeacherAnalyticsClientPage />;
}
