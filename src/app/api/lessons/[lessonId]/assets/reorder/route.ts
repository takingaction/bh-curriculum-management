import { createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function PATCH(request: Request, { params }: { params: Promise<{ lessonId: string }> }) {
  try {
    const { lessonId } = await params;
    const supabaseAdmin = await createServiceClient();
    const body = await request.json();
    const { orderedAssetIds } = body;

    if (!orderedAssetIds || !Array.isArray(orderedAssetIds)) {
      return NextResponse.json({ error: "orderedAssetIds array is required" }, { status: 400 });
    }

    // Update sort_order for each asset
    const updates = orderedAssetIds.map((assetId: string, index: number) => {
      return supabaseAdmin
        .from("lesson_assets")
        .update({ sort_order: index })
        .eq("lesson_id", lessonId)
        .eq("asset_id", assetId);
    });

    // Execute all updates
    const results = await Promise.all(updates);
    
    // Check for errors
    for (const result of results) {
      if (result.error) {
        return NextResponse.json({ error: result.error.message }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Reorder assets error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}