import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST() {
  const supabase = await createClient();
  
  const { data: { session }, error } = await supabase.auth.refreshSession();
  
  if (error || !session) {
    return NextResponse.json({ error: "Failed to refresh session" }, { status: 401 });
  }
  
  return NextResponse.json({ success: true, user: session.user });
}
