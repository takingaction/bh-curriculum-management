import { createClient, createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST(request: Request) {
  const cookieStore = await cookies();

  const supabase = await createClient();
  await supabase.auth.signOut();

  const serviceClient = await createServiceClient();
  await serviceClient.auth.signOut();

  cookieStore.getAll().forEach((cookie) => {
    cookieStore.delete(cookie.name);
  });

  const url = new URL("/login", request.url);
  return NextResponse.redirect(url, 303);
}

export async function GET(request: Request) {
  const cookieStore = await cookies();
  cookieStore.getAll().forEach((cookie) => {
    cookieStore.delete(cookie.name);
  });
  const url = new URL("/login", request.url);
  return NextResponse.redirect(url, 303);
}
