import { createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const supabaseAdmin = await createServiceClient();

    // List all buckets
    const { data: buckets, error: bucketsError } = await supabaseAdmin.storage.listBuckets();

    if (bucketsError) {
      return NextResponse.json({ error: bucketsError.message, bucketsError }, { status: 500 });
    }

    // Check if curriculum-assets exists
    const curriculumBucket = buckets?.find(b => b.id === 'curriculum-assets');

    // If curriculum-assets exists, try to list files in it
    let files: any[] = [];
    let filesError = null;
    if (curriculumBucket) {
      const listResult = await supabaseAdmin.storage.from('curriculum-assets').list('', { limit: 10 });
      files = listResult.data || [];
      filesError = listResult.error;
    }

    // Test public URL formation with actual file if exists
    let testResult = null;
    if (files.length > 0) {
      const firstFile = files[0];
      const publicUrl = supabaseAdmin.storage.from('curriculum-assets').getPublicUrl(firstFile.name);
      testResult = {
        filename: firstFile.name,
        publicUrl: publicUrl.data.publicUrl,
      };
    }

    return NextResponse.json({
      allBuckets: buckets?.map(b => ({ id: b.id, name: b.name, public: b.public })),
      curriculumBucketExists: !!curriculumBucket,
      filesInCurriculumAssets: files.map(f => ({ name: f.name, id: f.id })),
      filesError: filesError?.message,
      testResult,
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    });
  } catch (error: any) {
    console.error("Debug storage error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}