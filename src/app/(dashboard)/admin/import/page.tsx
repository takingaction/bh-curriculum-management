import { requireAdmin } from "@/lib/auth-helpers";
import ImportClientPage from "./page-client";

export default async function ImportPage() {
  await requireAdmin();
  return <ImportClientPage />;
}
