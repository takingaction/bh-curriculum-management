import { requireAdmin } from "@/lib/auth-helpers";
import TranslationFailuresClientPage from "./page-client";

export default async function TranslationFailuresPage() {
  await requireAdmin();
  return <TranslationFailuresClientPage />;
}
