import { createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const supabaseAdmin = await createServiceClient();

    const { data: asset, error: fetchError } = await supabaseAdmin
      .from("cfu_assets")
      .select("image_url")
      .eq("id", id)
      .single();

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (asset.image_url) {
      const urlParts = asset.image_url.split("/");
      const fileName = urlParts[urlParts.length - 1];

      await supabaseAdmin.storage.from("cfu-assets").remove([fileName]);
    }

    const { error: deleteError } = await supabaseAdmin
      .from("cfu_assets")
      .delete()
      .eq("id", id);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Delete cfu-assets error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}