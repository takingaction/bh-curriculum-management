import { createServiceClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";

export async function requireAuth() {
  const cookieStore = await cookies();
  const supabase = await createServiceClient();
  
  // Get user ID from cookies manually
  const authCookies = cookieStore.getAll();
  const authToken = authCookies.find(c => 
    c.name.includes('auth-token') && !c.name.includes('refresh')
  );
  
  if (!authToken) {
    console.log("requireAuth: no auth token cookie");
    redirect("/login");
  }
  
  // Decode JWT to get user ID
  try {
    const parts = authToken.value.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid JWT');
    }
    const payload = JSON.parse(atob(parts[1]));
    const userId = payload.sub;
    
    if (!userId) {
      throw new Error('No user ID in token');
    }
    
    // Verify user exists
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", userId)
      .single();
      
    if (!profile) {
      throw new Error('User not found');
    }
    
    return { id: userId };
  } catch (err) {
    console.log("requireAuth: JWT decode error", err);
    redirect("/login");
  }
}

export async function requireAdmin() {
  const user = await requireAuth();
  
  const cookieStore = await cookies();
  const supabase = await createServiceClient();
  
  // Check admin role
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
    
  if (error || profile?.role !== "admin") {
    console.log("requireAdmin: not admin", { profile, error });
    redirect("/dashboard");
  }
  
  return user;
}
