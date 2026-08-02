import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  console.log("Auth callback hit:", { code: code ? "present" : "missing", origin, next });

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    
    console.log("Exchange result:", { 
      hasUser: !!data.user, 
      hasError: !!error,
      errorMessage: error?.message,
      session: data.session ? "present" : "missing"
    });
    
    if (!error && data.user) {
      return NextResponse.redirect(`${origin}${next}`);
    }
    
    if (error) {
      console.error("Auth callback error:", error.message);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
