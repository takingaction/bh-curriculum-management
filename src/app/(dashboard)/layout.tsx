import { createClient, createServiceClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { UserMenu } from "@/components/user-menu";
import Link from "next/link";

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
          <div className="flex justify-between items-center h-[100px]">
            <div className="relative h-[80px] w-auto">
              <Link href={viewAs === "admin" ? "/admin" : "/teacher"} className="block">
                <img
                  src="/images/performers-ready.png"
                  alt="Performers Ready!"
                  className="h-full w-auto cursor-pointer"
                />
              </Link>
            </div>
            <div className="flex items-center">
              <UserMenu
                email={profile?.email || user.email || ""}
                fullName={profile?.full_name || null}
                role={profile?.role || "teacher"}
                isAdmin={isAdmin}
                viewAs={viewAs}
              />
            </div>
          </div>
        </div>
      </header>
      <main className="py-8">{children}</main>
    </div>
  );
}