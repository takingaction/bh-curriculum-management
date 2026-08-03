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
  const authTokenCookie = cookies.find(c => 
    (c.name.includes('auth-token') && !c.name.includes('refresh')) ||
    c.name === 'sb-access-token'
  );
  
  console.log("Auth token cookie:", authTokenCookie?.name);

  if (!authTokenCookie) {
    console.log("No auth token, redirecting to login");
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Decode JWT to get user ID (without verification for now)
  try {
    const parts = authTokenCookie.value.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid JWT format');
    }
    // Use atob for Edge-compatible base64 decode
    const payload = JSON.parse(atob(parts[1]));
    const userId = payload.sub;
    console.log("User ID from JWT:", userId);

    if (!userId) {
      throw new Error('No user ID in token');
    }

    // Check admin status using service client
    const supabaseAdmin = await createServiceClient();
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .single();

    console.log("Profile result:", { role: profile?.role, profileError: profileError?.message });

    if (pathname.startsWith("/admin")) {
      if (profile?.role !== "admin") {
        console.log("Not admin, redirecting to dashboard");
        return NextResponse.redirect(new URL("/dashboard", request.url));
      }
    }

    return NextResponse.next({ request });

  } catch (err) {
    console.log("JWT decode error:", err);
    return NextResponse.redirect(new URL("/login", request.url));
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
