import { requireAdmin } from "@/lib/auth-helpers";
import OnboardTeacherClientPage from "./page-client";

export default async function OnboardTeacherPage() {
  await requireAdmin();
  return <OnboardTeacherClientPage />;
}
