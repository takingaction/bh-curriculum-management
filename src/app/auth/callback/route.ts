import { createServerClient, createServerClient as createSupabaseServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

async function createServiceClient() {
  return createSupabaseServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() {
          return [];
        },
        setAll() {},
      },
    }
  );
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const type = searchParams.get("type");
  const next = searchParams.get("next") ?? "/dashboard";

  if (type === "recovery") {
    return NextResponse.redirect(`${origin}/reset-password`);
  }

  console.log("Auth callback hit:", { code: code ? "present" : "missing", origin, next });

  if (code) {
    const cookieStore = await cookies();

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              const cookieDomain = process.env.COOKIE_DOMAIN;
              cookiesToSet.forEach(({ name, value, options }) => {
                cookieStore.set(name, value, {
                  ...options,
                  ...(cookieDomain && { domain: cookieDomain }),
                });
              });
            } catch {
              // Server Component - ignore
            }
          },
        },
      }
    );

    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    console.log("Exchange result:", {
      hasUser: !!data.user,
      hasError: !!error,
      errorMessage: error?.message,
      session: data.session ? "present" : "missing"
    });

    if (!error && data.user) {
      try {
        const supabaseAdmin = await createServiceClient();
        await supabaseAdmin
          .from("user_activity_log")
          .insert({
            user_id: data.user.id,
            action: "login",
            resource_id: null,
          });
      } catch (logError) {
        console.error("Failed to log login activity:", logError);
      }
      return NextResponse.redirect(`${origin}${next}`);
    }

    if (error) {
      console.error("Auth callback error:", error.message);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
