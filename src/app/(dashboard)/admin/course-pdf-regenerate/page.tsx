import { requireAdmin } from "@/lib/auth-helpers";
import BatchCoursePdfRegenerateClientPage from "./page-client";

export default async function BatchCoursePdfRegeneratePage() {
  await requireAdmin();
  return <BatchCoursePdfRegenerateClientPage />;
}
