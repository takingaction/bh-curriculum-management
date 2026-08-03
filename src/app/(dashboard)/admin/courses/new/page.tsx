import { requireAdmin } from "@/lib/auth-helpers";
import NewCourseClientPage from "./page-client";

export default async function NewCoursePage() {
  await requireAdmin();
  return <NewCourseClientPage />;
}
