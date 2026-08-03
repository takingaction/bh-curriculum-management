import { requireAdmin } from "@/lib/auth-helpers";
import TeachersClientPage from "./page-client";

export default async function TeachersPage() {
  await requireAdmin();
  return <TeachersClientPage />;
}
