import { createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { filename, fileType, fileSize, categoryId } = body;

    if (!filename || !fileType) {
      return NextResponse.json({ error: "Filename and file type are required" }, { status: 400 });
    }

    const supabaseAdmin = await createServiceClient();

    // Generate a unique storage path
    const timestamp = Date.now();
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, "_");
    const storagePath = `assets/${timestamp}-${sanitizedFilename}`;

    // Create a signed upload URL using Supabase Storage
    // This allows client-side direct upload without going through serverless
    const { data: signedUrlData, error: signError } = await supabaseAdmin.storage
      .from("curriculum-assets")
      .createSignedUploadUrl(storagePath);

    if (signError) {
      console.error("Sign URL error:", signError);
      return NextResponse.json({ 
        error: signError.message,
        details: "Failed to create signed URL. Check if bucket exists and RLS policies allow upload."
      }, { status: 500 });
    }

    console.log("Signed URL created:", signedUrlData);

    return NextResponse.json({
      uploadUrl: signedUrlData.signedUrl,
      storagePath,
      filename,
      fileType,
      fileSize,
      categoryId,
    });
  } catch (error: any) {
    console.error("Generate upload URL error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
