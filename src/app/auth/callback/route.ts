import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (!error && data.user) {
      return NextResponse.redirect(`${origin}${next}`);
    }
    
    if (error) {
      console.error("Auth callback error:", error.message);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
