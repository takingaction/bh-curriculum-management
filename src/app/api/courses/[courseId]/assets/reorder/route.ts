import { createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function PATCH(request: Request, { params }: { params: Promise<{ courseId: string }> }) {
  try {
    const { courseId } = await params;
    const supabaseAdmin = await createServiceClient();
    const body = await request.json();
    const { orderedAssetIds } = body;

    if (!orderedAssetIds || !Array.isArray(orderedAssetIds)) {
      return NextResponse.json({ error: "orderedAssetIds array is required" }, { status: 400 });
    }

    const updates = orderedAssetIds.map((assetId: string, index: number) =>
      supabaseAdmin
        .from("course_assets")
        .update({ sort_order: index })
        .eq("course_id", courseId)
        .eq("asset_id", assetId)
    );

    await Promise.all(updates);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Reorder course assets error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
