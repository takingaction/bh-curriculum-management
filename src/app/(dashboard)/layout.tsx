import { createClient, createServiceClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const supabaseAdmin = await createServiceClient();
  const cookieStore = await cookies();
  const viewAs = cookieStore.get("view_as")?.value || "admin";

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  const isAdmin = profile?.role === "admin";

  return (
    <div className="min-h-screen bg-[#f5f5f0]">
      <header className="bg-white border-b border-[#e5e5e0]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div>
              <h1 className="text-xl font-bold text-[#0d7377]">Performers Ready!</h1>
              <p className="text-xs text-[#666666]">Curriculum Management</p>
            </div>
            <div className="flex items-center gap-4">
              <a
                href={viewAs === "teacher" ? "/teacher" : "/admin"}
                className="text-sm text-[#0d7377] hover:underline font-medium"
              >
                Dashboard
              </a>
              {isAdmin && (
                <form action="/api/toggle-view" method="post">
                  <input type="hidden" name="view" value={viewAs === "admin" ? "teacher" : "admin"} />
                  <button
                    type="submit"
                    className="text-xs px-4 py-2 bg-[#0d7377] text-white rounded-lg hover:bg-[#0a5c5f] transition-colors"
                  >
                    View as {viewAs === "admin" ? "Teacher" : "Admin"}
                  </button>
                </form>
              )}
              <span className="text-sm text-[#2d2d2d]">{profile?.email}</span>
              <span className="text-xs px-3 py-1 bg-[#f5f5f0] text-[#666666] rounded-full">
                {profile?.role || "admin"}
              </span>
              <form action="/auth/signout" method="post">
                <button type="submit" className="text-sm text-[#e85d5d] hover:underline font-medium">
                  Sign out
                </button>
              </form>
            </div>
          </div>
        </div>
      </header>
      <main className="py-8">{children}</main>
    </div>
  );
}
