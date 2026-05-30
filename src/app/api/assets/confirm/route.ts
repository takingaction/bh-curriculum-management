import { createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const supabaseAdmin = await createServiceClient();
    const body = await request.json();
    const { filename, displayName, storagePath, publicUrl, fileType, fileSize, categoryId } = body;

    if (!filename || !storagePath || !publicUrl || !fileType) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("assets")
      .insert({
        filename,
        display_name: displayName || filename,
        storage_path: storagePath,
        public_url: publicUrl,
        file_type: fileType,
        file_size: fileSize || 0,
        category_id: categoryId || null,
      })
      .select("*, asset_categories(name)")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ asset: data });
  } catch (error: any) {
    console.error("Confirm asset upload error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
