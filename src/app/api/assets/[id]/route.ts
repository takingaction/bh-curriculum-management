import { createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabaseAdmin = await createServiceClient();
    const body = await request.json();
    const { display_name, category_id, storagePath, publicUrl, filename, fileType, fileSize } = body;

    const isReplacement =
      typeof storagePath === "string" &&
      typeof publicUrl === "string" &&
      typeof filename === "string" &&
      typeof fileType === "string" &&
      typeof fileSize === "number";

    let oldStoragePath: string | null = null;
    let oldPublicUrl: string | null = null;

    if (isReplacement) {
      const { data: existing, error: fetchError } = await supabaseAdmin
        .from("assets")
        .select("storage_path, public_url")
        .eq("id", id)
        .single();

      if (fetchError) {
        return NextResponse.json({ error: fetchError.message }, { status: 500 });
      }

      oldStoragePath = existing?.storage_path ?? null;
      oldPublicUrl = existing?.public_url ?? null;
    }

    const updatePayload: Record<string, unknown> = {};
    if (typeof display_name !== "undefined") updatePayload.display_name = display_name;
    if (typeof category_id !== "undefined") updatePayload.category_id = category_id;
    if (isReplacement) {
      updatePayload.storage_path = storagePath;
      updatePayload.public_url = publicUrl;
      updatePayload.filename = filename;
      updatePayload.file_type = fileType;
      updatePayload.file_size = fileSize;
      if (oldPublicUrl && oldPublicUrl !== publicUrl) {
        updatePayload.previous_public_urls = [oldPublicUrl];
      }
    }

    const { data, error } = await supabaseAdmin
      .from("assets")
      .update(updatePayload)
      .eq("id", id)
      .select("*, asset_categories(name)")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (isReplacement && oldStoragePath && oldStoragePath !== storagePath) {
      try {
        await supabaseAdmin.storage.from("curriculum-assets").remove([oldStoragePath]);
      } catch (storageError) {
        console.error("Old storage delete error (non-fatal):", storageError);
      }
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
