import { createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const supabaseAdmin = await createServiceClient();
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const courseId = formData.get("courseId") as string;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!courseId) {
      return NextResponse.json({ error: "No course ID provided" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const filename = file.name;
    const storagePath = `${courseId}/image/${filename}`;

    const { data, error } = await supabaseAdmin.storage
      .from("course-images")
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (error) {
      console.error("Storage upload error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const { data: urlData } = supabaseAdmin.storage
      .from("course-images")
      .getPublicUrl(data.path);

    const imageUrl = urlData.publicUrl;

    const { data: imageRecord, error: dbError } = await supabaseAdmin
      .from("course_images")
      .insert({
        course_id: courseId,
        filename: filename,
        storage_path: storagePath,
        public_url: imageUrl,
      })
      .select()
      .single();

    if (dbError) {
      console.error("Database insert error:", dbError);
      return NextResponse.json({ error: dbError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      imageUrl,
      filename,
      id: imageRecord.id,
    });
  } catch (error: any) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
