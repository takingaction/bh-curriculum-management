import { createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST() {
  try {
    const supabaseAdmin = await createServiceClient();

    // Get all assets with old-format public URLs
    const { data: assets, error: fetchError } = await supabaseAdmin
      .from("assets")
      .select("id, public_url, storage_path")
      .like("public_url", "%/object/public/assets/%");

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (!assets || assets.length === 0) {
      return NextResponse.json({ message: "No assets to fix", count: 0 });
    }

    // Fix each asset's public_url
    const updates = [];
    for (const asset of assets) {
      // The storage_path is like "assets/filename.pdf"
      // The correct public_url should be ".../object/public/curriculum-assets/assets/filename.pdf"
      const correctPublicUrl = `https://jextdmsoqpeokvwulcbh.supabase.co/storage/v1/object/public/curriculum-assets/${asset.storage_path}`;

      updates.push({
        id: asset.id,
        public_url: correctPublicUrl,
      });
    }

    // Batch update
    for (const update of updates) {
      await supabaseAdmin
        .from("assets")
        .update({ public_url: update.public_url })
        .eq("id", update.id);
    }

    return NextResponse.json({
      message: `Fixed ${updates.length} asset URLs`,
      count: updates.length,
      sampleUrl: updates[0]?.public_url,
    });
  } catch (error: any) {
    console.error("Fix URLs error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}