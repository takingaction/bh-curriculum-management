import { requireAdmin } from "@/lib/auth-helpers";
import UserAccessClientPage from "./page-client";

export default async function UserAccessPage() {
  await requireAdmin();
  return <UserAccessClientPage />;
}
