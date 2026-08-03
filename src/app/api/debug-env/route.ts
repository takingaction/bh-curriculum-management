import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ? "set" : "missing",
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "set" : "missing",
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ? "set" : "missing",
  });
}
