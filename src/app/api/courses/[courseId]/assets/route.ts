import { createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request, { params }: { params: Promise<{ courseId: string }> }) {
  try {
    const { courseId } = await params;
    const supabaseAdmin = await createServiceClient();

    const { data, error } = await supabaseAdmin
      .from("course_assets")
      .select(`
        id,
        created_at,
        sort_order,
        assets (
          *,
          asset_categories (name)
        )
      `)
      .eq("course_id", courseId)
      .order("sort_order", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const assets = data?.map((ca: any) => ({
      course_asset_id: ca.id,
      sort_order: ca.sort_order,
      created_at: ca.created_at,
      ...ca.assets,
    })) || [];

    return NextResponse.json({ assets });
  } catch (error: any) {
    console.error("Get course assets error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ courseId: string }> }) {
  try {
    const { courseId } = await params;
    const supabaseAdmin = await createServiceClient();
    const body = await request.json();
    const { assetId } = body;

    if (!assetId) {
      return NextResponse.json({ error: "Asset ID is required" }, { status: 400 });
    }

    const { data: maxData } = await supabaseAdmin
      .from("course_assets")
      .select("sort_order")
      .eq("course_id", courseId)
      .order("sort_order", { ascending: false })
      .limit(1);

    const maxSortOrder = maxData && maxData.length > 0 ? maxData[0].sort_order : -1;
    const newSortOrder = maxSortOrder + 1;

    const { data, error } = await supabaseAdmin
      .from("course_assets")
      .insert({ course_id: courseId, asset_id: assetId, sort_order: newSortOrder })
      .select(`
        id,
        created_at,
        sort_order,
        assets (
          *,
          asset_categories (name)
        )
      `)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ courseAsset: data });
  } catch (error: any) {
    console.error("Attach asset error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
