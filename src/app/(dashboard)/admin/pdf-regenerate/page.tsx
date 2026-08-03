import { requireAdmin } from "@/lib/auth-helpers";
import BatchPdfRegenerateClientPage from "./page-client";

export default async function BatchPdfRegeneratePage() {
  await requireAdmin();
  return <BatchPdfRegenerateClientPage />;
}
