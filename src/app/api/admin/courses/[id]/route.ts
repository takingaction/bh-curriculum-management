import { createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServiceClient();
    const { id } = await params;
    const body = await request.json();

    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (body.spotify_embed_code !== undefined) {
      updateData.spotify_embed_code = body.spotify_embed_code;
    }

    if (body.title !== undefined) {
      updateData.title = body.title;
    }

    if (body.discipline !== undefined) {
      updateData.discipline = body.discipline;
    }

    if (body.grade !== undefined) {
      updateData.grade = body.grade;
    }

    if (body.summary !== undefined) {
      updateData.summary = body.summary;
    }

    const { data, error } = await supabase
      .from("courses")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServiceClient();
    const { id } = await params;

    await supabase.from("courses").delete().eq("id", id);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}