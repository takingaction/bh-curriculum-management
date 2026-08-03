import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET() {
  const cookieStore = await cookies();
  const viewAs = cookieStore.get("view_as")?.value || "teacher";
  return NextResponse.json({ viewAs });
}
