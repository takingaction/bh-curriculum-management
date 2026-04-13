import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <h1 className="text-xl font-semibold">Curriculum Management</h1>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">{profile?.email}</span>
              <span className="text-xs px-2 py-1 bg-gray-100 rounded">{profile?.role}</span>
              <form action="/auth/signout" method="post">
                <button type="submit" className="text-sm text-red-600 hover:underline">
                  Sign out
                </button>
              </form>
            </div>
          </div>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
