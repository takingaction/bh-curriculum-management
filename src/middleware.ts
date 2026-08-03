import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  console.log("Middleware running:", request.nextUrl.pathname);

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("Missing Supabase environment variables");
    return NextResponse.next({ request });
  }

  // Get cookies manually first
  const authCookieName = `sb-${supabaseUrl.split('://')[1]}-auth-token`;
  const authToken = request.cookies.get(authCookieName)?.value;
  const refreshToken = request.cookies.get(`${authCookieName}-refresh-token`)?.value;
  
  console.log("Auth token present:", !!authToken, "Refresh token present:", !!refreshToken);
  console.log("Auth cookie name:", authCookieName);
  console.log("All cookies:", request.cookies.getAll().map(c => c.name));

  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
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

  // Try to get user - this will use the cookies we just passed
  const { data: { user }, error } = await supabase.auth.getUser();
  
  console.log("getUser result:", { hasUser: !!user, error: error?.message });

  const pathname = request.nextUrl.pathname;

  // Public paths that don't require auth
  if (pathname.startsWith("/teacher")) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (pathname.startsWith("/login") || pathname.startsWith("/signup")) {
    if (user) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return supabaseResponse;
  }

  if (pathname.startsWith("/admin")) {
    if (!user) {
      console.log("No user, redirecting to login");
      return NextResponse.redirect(new URL("/login", request.url));
    }
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "admin") {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  if (pathname.startsWith("/dashboard")) {
    if (!user) {
      console.log("Dashboard access but no user, redirecting to login");
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  if (pathname.startsWith("/profile")) {
    if (!user) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
