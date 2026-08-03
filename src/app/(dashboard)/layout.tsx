import { createClient, getSession } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { UserMenu } from "@/components/user-menu";
import Link from "next/link";
import Footer from "@/components/home/Footer";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const { data: { session } } = await getSession();

  if (!session) {
    redirect("/login");
  }

  const user = session.user;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  const isAdmin = profile?.role === "admin";

  return (
    <div className="min-h-screen bg-white">
      <header className="bg-white border-b border-[#e5e5e0]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div style={{ height: '72px', paddingTop: '6px', paddingBottom: '6px' }}>
              <Link href="/dashboard" className="block h-full">
                <img
                  src="/images/performers-ready.png"
                  alt="Performers Ready!"
                  style={{ height: '72px', width: 'auto' }}
                />
              </Link>
            </div>
            <div className="flex items-center">
              <UserMenu
                email={profile?.email || user.email || ""}
                fullName={profile?.full_name || null}
                role={profile?.role || "teacher"}
                isAdmin={isAdmin}
              />
            </div>
          </div>
        </div>
      </header>
      <main className="py-2">{children}</main>
      <Footer />
    </div>
  );
}
