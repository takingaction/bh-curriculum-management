import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const view = searchParams.get("view");

  if (!view || (view !== "teacher" && view !== "admin")) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const cookieStore = await cookies();
  cookieStore.set("view_as", view, {
    path: "/",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24,
  });

  if (view === "teacher") {
    return NextResponse.redirect(new URL("/teacher", request.url));
  }
  return NextResponse.redirect(new URL("/admin/courses", request.url));
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const view = formData.get("view") as string;

  const cookieStore = await cookies();
  cookieStore.set("view_as", view, {
    path: "/",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24,
  });

  if (view === "teacher") {
    return NextResponse.redirect(new URL("/teacher", request.url));
  }
  return NextResponse.redirect(new URL("/admin/courses", request.url));
}