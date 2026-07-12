import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { paths } = body as { paths: string[] };

    if (!paths || !Array.isArray(paths) || paths.length === 0) {
      return NextResponse.json({ error: "No paths provided" }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: "Missing Supabase environment variables" }, { status: 500 });
    }

    // Use Supabase Storage REST API for batch delete
    const response = await fetch(
      `${supabaseUrl}/storage/v1/object/delete`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${supabaseServiceKey}`,
          "apikey": supabaseServiceKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          files: paths.map(p => `course-images/${p}`),
          bucketId: "course-images",
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Storage API error:", response.status, errorText);
      return NextResponse.json({ error: `Storage API error: ${response.status} - ${errorText}` }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      deleted: paths,
      count: paths.length,
    });
  } catch (error: any) {
    console.error("Delete error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
