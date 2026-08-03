import { requireAdmin } from "@/lib/auth-helpers";
import ImportTeachersClientPage from "./page-client";

export default async function ImportTeachersPage() {
  await requireAdmin();
  return <ImportTeachersClientPage />;
}
