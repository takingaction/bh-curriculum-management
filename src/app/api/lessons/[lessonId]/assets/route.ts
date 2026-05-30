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
        assets (
          *,
          asset_categories (name)
        )
      `)
      .eq("lesson_id", lessonId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Flatten the response
    const assets = data?.map((la: any) => ({
      lesson_asset_id: la.id,
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

    const { data, error } = await supabaseAdmin
      .from("lesson_assets")
      .insert({ lesson_id: lessonId, asset_id: assetId })
      .select(`
        id,
        created_at,
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
