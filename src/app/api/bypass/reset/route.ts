import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { validateBypassCode, validateUniversalToken } from "@/lib/bypass-utils";

export async function POST(request: Request) {
  try {
    const supabaseAdmin = await createServiceClient();
    const body = await request.json();

    const { code, email, newPassword } = body;

    if (!code || !email || !newPassword) {
      return NextResponse.json(
        { error: "Code, email, and new password are required" },
        { status: 400 }
      );
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    const hasLower = /[a-z]/.test(newPassword);
    const hasUpper = /[A-Z]/.test(newPassword);
    const hasDigit = /[0-9]/.test(newPassword);
    const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(newPassword);

    if (!hasLower || !hasUpper || !hasDigit || !hasSpecial) {
      return NextResponse.json(
        { error: "Password must contain lowercase, uppercase, digits, and symbols" },
        { status: 400 }
      );
    }

    const universalValidation = await validateUniversalToken(supabaseAdmin, code, email);

    if (universalValidation.valid) {
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("email", email.toLowerCase())
        .single();

      if (!profile) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        profile.id,
        { password: newPassword }
      );

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        message: "Password has been reset successfully. You can now sign in with your new password."
      });
    }

    const codeValidation = await validateBypassCode(supabaseAdmin, code, email);

    if (!codeValidation.valid) {
      return NextResponse.json({ error: codeValidation.error }, { status: 400 });
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("email", email.toLowerCase())
      .single();

    if (!profile) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      profile.id,
      { password: newPassword }
    );

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    const { error: markUsedError } = await supabaseAdmin
      .from("bypass_codes")
      .update({ used_at: new Date().toISOString() })
      .eq("code", code.toUpperCase());

    if (markUsedError) {
      console.error("Failed to mark code as used:", markUsedError);
    }

    return NextResponse.json({
      success: true,
      message: "Password has been reset successfully. You can now sign in with your new password."
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : "An unexpected error occurred";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
