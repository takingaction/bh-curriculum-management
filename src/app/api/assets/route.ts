import { createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const search = searchParams.get("search");
    const fileType = searchParams.get("fileType");

    const supabaseAdmin = await createServiceClient();

    let query = supabaseAdmin
      .from("assets")
      .select("*, asset_categories(name)")
      .order("created_at", { ascending: false });

    if (category) {
      query = query.eq("category_id", category);
    }

    if (fileType) {
      query = query.eq("file_type", fileType);
    }

    if (search) {
      query = query.or(`filename.ilike.%${search}%,display_name.ilike.%${search}%`);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ assets: data });
  } catch (error: any) {
    console.error("Get assets error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
