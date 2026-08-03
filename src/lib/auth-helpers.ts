import { createClient, getSession } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function requireAuth() {
  const { data: { session } } = await getSession();
  
  if (!session) {
    redirect("/login");
  }
  
  return { id: session.user.id };
}

export async function requireAdmin() {
  const { data: { session } } = await getSession();
  
  if (!session) {
    redirect("/login");
  }
  
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", session.user.id)
    .single();
    
  if (profile?.role !== "admin") {
    redirect("/dashboard");
  }
  
  return { id: session.user.id };
}
