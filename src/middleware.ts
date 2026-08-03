import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const pathname = request.nextUrl.pathname;
  console.log("=== Middleware ===");
  console.log("Path:", pathname);

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("Missing env vars");
    return NextResponse.next({ request });
  }

  // Public paths - allow through without auth
  if (pathname.startsWith("/teacher") || pathname.startsWith("/login") || 
      pathname.startsWith("/signup") || pathname.startsWith("/auth/") ||
      pathname.startsWith("/api/") || pathname.startsWith("/_next")) {
    console.log("Public path - allowing");
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          const cookies = request.cookies.getAll();
          console.log("Cookies in getAll:", cookies.map(c => c.name));
          return cookies;
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            supabaseResponse = NextResponse.next({ request });
            supabaseResponse.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const { data: { user }, error } = await supabase.auth.getUser();
  
  console.log("getUser result:", { hasUser: !!user, error: error?.message });

  if (!user) {
    console.log("No user - redirect to login");
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (pathname.startsWith("/admin")) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "admin") {
      console.log("Not admin - redirect to dashboard");
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  console.log("Allow through");
  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
