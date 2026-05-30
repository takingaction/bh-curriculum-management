import { createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabaseAdmin = await createServiceClient();
    const body = await request.json();
    const { display_name, category_id } = body;

    const { data, error } = await supabaseAdmin
      .from("assets")
      .update({ display_name, category_id })
      .eq("id", id)
      .select("*, asset_categories(name)")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ asset: data });
  } catch (error: any) {
    console.error("Update asset error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabaseAdmin = await createServiceClient();

    // First get the asset to delete from storage
    const { data: asset, error: fetchError } = await supabaseAdmin
      .from("assets")
      .select("storage_path")
      .eq("id", id)
      .single();

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    // Delete from Supabase Storage
    try {
      if (asset.storage_path) {
        await supabaseAdmin.storage
          .from("curriculum-assets")
          .remove([asset.storage_path]);
      }
    } catch (storageError) {
      console.error("Storage delete error:", storageError);
      // Continue anyway - might be already deleted or different error
    }

    // Delete from database (cascade will handle lesson_assets)
    const { error: deleteError } = await supabaseAdmin
      .from("assets")
      .delete()
      .eq("id", id);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Delete asset error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
