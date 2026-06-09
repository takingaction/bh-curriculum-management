import { createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const supabaseAdmin = await createServiceClient();

    const { data, error } = await supabaseAdmin
      .from("cfu_assets")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ assets: data });
  } catch (error: any) {
    console.error("Get cfu-assets error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const name = formData.get("name") as string;
    const assetType = formData.get("asset_type") as "background" | "png";

    if (!file || !name || !assetType) {
      return NextResponse.json(
        { error: "Missing file, name, or asset_type" },
        { status: 400 }
      );
    }

    const supabaseAdmin = await createServiceClient();

    const fileBuffer = await file.arrayBuffer();
    const fileExt = file.name.split(".").pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from("cfu-assets")
      .upload(fileName, fileBuffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    const { data: urlData } = supabaseAdmin.storage
      .from("cfu-assets")
      .getPublicUrl(fileName);

    const { data: dbData, error: dbError } = await supabaseAdmin
      .from("cfu_assets")
      .insert({
        name,
        image_url: urlData.publicUrl,
        asset_type: assetType,
      })
      .select()
      .single();

    if (dbError) {
      return NextResponse.json({ error: dbError.message }, { status: 500 });
    }

    return NextResponse.json({ asset: dbData });
  } catch (error: any) {
    console.error("Upload cfu-assets error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}