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

    const fileName = `${courseId}/${Date.now()}-${file.name}`;

    const { data, error } = await supabaseAdmin.storage
      .from("course-hero-images")
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (error) {
      console.error("Storage upload error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const { data: urlData } = supabaseAdmin.storage
      .from("course-hero-images")
      .getPublicUrl(data.path);

    const imageUrl = urlData.publicUrl;

    const uploadType = formData.get("type") as string;
    const updateField = uploadType === "pdf" ? { pdf_image_url: imageUrl } : { image_url: imageUrl };

    const { error: updateError } = await supabaseAdmin
      .from("courses")
      .update(updateField)
      .eq("id", courseId);

    if (updateError) {
      console.error("Course update error:", updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, imageUrl });
  } catch (error: any) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}