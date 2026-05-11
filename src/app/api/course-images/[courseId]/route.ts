import { createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    const supabaseAdmin = await createServiceClient();
    const { courseId } = await params;

    const { data: images, error } = await supabaseAdmin
      .from("course_images")
      .select("*")
      .eq("course_id", courseId)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ images });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    const supabaseAdmin = await createServiceClient();
    const { courseId } = await params;
    const { searchParams } = new URL(request.url);
    const imageId = searchParams.get("imageId");
    const storagePath = searchParams.get("storagePath");

    if (!imageId) {
      return NextResponse.json({ error: "Image ID required" }, { status: 400 });
    }

    let deleteError;

    if (storagePath) {
      const { error } = await supabaseAdmin.storage
        .from("course-images")
        .remove([storagePath]);
      deleteError = error;
    }

    if (deleteError) {
      console.error("Storage delete error:", deleteError);
    }

    const { error: dbError } = await supabaseAdmin
      .from("course_images")
      .delete()
      .eq("id", imageId);

    if (dbError) {
      return NextResponse.json({ error: dbError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
