import { createServiceClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";

export async function requireAuth() {
  const cookieStore = await cookies();
  const supabase = await createServiceClient();
  
  // Get user ID from cookies manually
  const authCookies = cookieStore.getAll();
  console.log("requireAuth cookies:", authCookies.map(c => c.name));
  
  const authToken = authCookies.find(c => 
    (c.name.includes('auth-token') && !c.name.includes('refresh')) ||
    c.name === 'sb-access-token'
  );
  
  if (!authToken) {
    console.log("requireAuth: no auth token cookie");
    redirect("/login");
  }
  
  console.log("requireAuth: found token cookie:", authToken.name);
  
  // Decode JWT to get user ID
  try {
    const parts = authToken.value.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid JWT');
    }
    const payload = JSON.parse(atob(parts[1]));
    const userId = payload.sub;
    
    console.log("requireAuth: userId from JWT:", userId);
    
    if (!userId) {
      throw new Error('No user ID in token');
    }
    
    // Verify user exists
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", userId)
      .single();
      
    console.log("requireAuth: profile lookup:", { profile, error: profileError?.message });
      
    if (!profile) {
      throw new Error('User not found');
    }
    
    return { id: userId };
  } catch (err) {
    console.log("requireAuth: error", err);
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
    
  console.log("requireAdmin:", { profile, error: error?.message });
    
  if (error || profile?.role !== "admin") {
    console.log("requireAdmin: not admin");
    redirect("/dashboard");
  }
  
  return user;
}
