import { createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const supabaseAdmin = await createServiceClient();

    // Find images with CLARA_Swash_Teal_ in filename
    const { data: images, error } = await supabaseAdmin
      .from("course_images")
      .select("id, filename, storage_path, course_id")
      .ilike("filename", "%CLARA_Swash_Teal_%");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      count: images?.length || 0,
      images: images || [],
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
