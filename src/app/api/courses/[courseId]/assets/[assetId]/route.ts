import { createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ courseId: string; assetId: string }> }
) {
  try {
    const { courseId, assetId } = await params;
    const supabaseAdmin = await createServiceClient();

    const { error } = await supabaseAdmin
      .from("course_assets")
      .delete()
      .eq("course_id", courseId)
      .eq("asset_id", assetId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Remove course asset error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
