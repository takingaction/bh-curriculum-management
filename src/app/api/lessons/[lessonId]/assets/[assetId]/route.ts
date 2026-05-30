import { createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function DELETE(request: Request, { params }: { params: Promise<{ lessonId: string; assetId: string }> }) {
  try {
    const { lessonId, assetId } = await params;
    const supabaseAdmin = await createServiceClient();

    const { error } = await supabaseAdmin
      .from("lesson_assets")
      .delete()
      .eq("lesson_id", lessonId)
      .eq("asset_id", assetId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Detach asset error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
