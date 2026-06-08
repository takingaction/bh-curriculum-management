import { createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request, { params }: { params: Promise<{ lessonId: string }> }) {
  try {
    const { lessonId } = await params;
    const supabaseAdmin = await createServiceClient();

    const { data, error } = await supabaseAdmin
      .from("lesson_assets")
      .select(`
        id,
        created_at,
        sort_order,
        assets (
          *,
          asset_categories (name)
        )
      `)
      .eq("lesson_id", lessonId)
      .order("sort_order", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Flatten the response
    const assets = data?.map((la: any) => ({
      lesson_asset_id: la.id,
      sort_order: la.sort_order,
      created_at: la.created_at,
      ...la.assets,
    })) || [];

    return NextResponse.json({ assets });
  } catch (error: any) {
    console.error("Get lesson assets error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ lessonId: string }> }) {
  try {
    const { lessonId } = await params;
    const supabaseAdmin = await createServiceClient();
    const body = await request.json();
    const { assetId } = body;

    if (!assetId) {
      return NextResponse.json({ error: "Asset ID is required" }, { status: 400 });
    }

    // Get max sort_order for this lesson
    const { data: maxData } = await supabaseAdmin
      .from("lesson_assets")
      .select("sort_order")
      .eq("lesson_id", lessonId)
      .order("sort_order", { ascending: false })
      .limit(1);

    const maxSortOrder = maxData && maxData.length > 0 ? maxData[0].sort_order : -1;
    const newSortOrder = maxSortOrder + 1;

    const { data, error } = await supabaseAdmin
      .from("lesson_assets")
      .insert({ lesson_id: lessonId, asset_id: assetId, sort_order: newSortOrder })
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

    return NextResponse.json({ lessonAsset: data });
  } catch (error: any) {
    console.error("Attach asset error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
