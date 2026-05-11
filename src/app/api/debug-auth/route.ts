import { createClient, createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();
  
  const {
    data: { user },
  } = await supabase.auth.getUser();
  
  let profile = null;
  let profileWithServiceRole = null;
  
  if (user) {
    // Regular client query (affected by RLS)
    const { data } = await supabase
      .from("profiles")
      .select("id, email, role")
      .eq("id", user.id)
      .single();
    profile = data;
    
    // Service role client (bypasses RLS)
    const supabaseAdmin = await createServiceClient();
    const { data: adminData } = await supabaseAdmin
      .from("profiles")
      .select("id, email, role")
      .eq("id", user.id)
      .single();
    profileWithServiceRole = adminData;
  }
  
  return NextResponse.json({
    authUserId: user?.id || null,
    authUserEmail: user?.email || null,
    profileWithRls: profile,
    profileWithServiceRole: profileWithServiceRole,
    env: {
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ? "set" : "missing",
      anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "set" : "missing",
      serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ? "set" : "missing",
    }
  });
}