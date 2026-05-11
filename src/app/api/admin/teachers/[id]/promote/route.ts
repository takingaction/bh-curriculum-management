import { createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabaseAdmin = await createServiceClient();
    const { id } = await params;

    const { data: updatedProfile, error } = await supabaseAdmin
      .from("profiles")
      .update({ role: "admin" })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    if (!updatedProfile) {
      return NextResponse.json(
        { error: "Profile not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `User ${updatedProfile.email} promoted to admin`,
      profile: updatedProfile,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}