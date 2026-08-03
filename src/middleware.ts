import { createServerClient } from "@supabase/ssr";
import { createServiceClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  console.log("Middleware running:", request.nextUrl.pathname);

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("Missing Supabase environment variables");
    return NextResponse.next({ request });
  }

  const pathname = request.nextUrl.pathname;

  // Public paths that don't require auth
  if (pathname.startsWith("/teacher")) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (pathname.startsWith("/login") || pathname.startsWith("/signup")) {
    return NextResponse.next({ request });
  }

  // Get cookies directly from request
  const cookies = request.cookies.getAll();
  console.log("Cookies count:", cookies.length);
  
  // Find the auth token cookie
  const authTokenCookie = cookies.find(c => c.name.includes('auth-token') && !c.name.includes('refresh'));
  const refreshTokenCookie = cookies.find(c => c.name.includes('refresh-token'));
  
  console.log("Auth token cookie found:", !!authTokenCookie, "Name:", authTokenCookie?.name);
  console.log("Refresh token cookie found:", !!refreshTokenCookie);

  let supabaseResponse = NextResponse.next({ request });

  // If no auth cookies at all, redirect to login
  if (!authTokenCookie) {
    console.log("No auth token cookie, redirecting to login");
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return cookies;
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // Try to get user with the existing cookies
  const { data: { user }, error } = await supabase.auth.getUser();
  
  console.log("getUser result:", { hasUser: !!user, error: error?.message });

  if (!user) {
    console.log("No user from getUser, redirecting to login");
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (pathname.startsWith("/admin")) {
    // Use service client to bypass RLS for profile check
    const supabaseAdmin = await createServiceClient();
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    console.log("Profile query result:", { profile: profile?.role, profileError: profileError?.message });

    if (profileError || profile?.role !== "admin") {
      console.log("Not admin or profile error, redirecting to dashboard");
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  if (pathname.startsWith("/dashboard") || pathname.startsWith("/profile")) {
    // Allow access - user is authenticated
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
