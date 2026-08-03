"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import Header from "@/components/home/Header";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const checkRes = await fetch("/api/auth/check-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const checkData = await checkRes.json();

    if (!checkData.exists) {
      setError("No account found with this email. Please sign up for a free trial first.");
      setLoading(false);
      return;
    }

    const origin = window.location.origin;
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/reset-password`,
    });

    if (resetError) {
      setError(resetError.message);
      setLoading(false);
      return;
    }

    setEmailSent(true);
    setLoading(false);
  };

  if (emailSent) {
    return (
      <>
        <Header />
        <div className="min-h-screen bg-gray-50 flex justify-center py-12 px-4">
          <div className="w-full max-w-md p-8 bg-white rounded-xl shadow-lg mx-4 mt-32">
            <div className="mb-8 text-center">
              <h1 className="text-2xl font-bold text-[#0d7377] mb-2">Performers Ready!</h1>
              <p className="text-[#666666]">Curriculum Management Platform</p>
            </div>
            <div className="text-center space-y-4">
              <div className="p-4 bg-[#d7ffef] rounded-lg">
                <p className="text-[#2d2d2d]">
                  Password reset link sent to <strong>{email}</strong>
                </p>
              </div>
              <p className="text-sm text-gray-500">
                Click the link in your email to reset your password.
              </p>
              <p className="text-xs text-gray-400">
                Didn&apos;t receive it? Check your spam folder or try again.
              </p>
            </div>
            <div className="mt-6 text-center">
              <Link href="/login" className="text-[#0d7377] hover:underline font-medium text-sm">
                Back to sign in
              </Link>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Header />
      <div className="min-h-screen bg-gray-50 flex justify-center py-12 px-4">
        <div className="w-full max-w-md p-8 bg-white rounded-xl shadow-lg mx-4 mt-32">
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-bold text-[#0d7377] mb-2">Reset Your Password</h1>
            <p className="text-[#666666]">Enter your email to receive a reset link</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-3 text-sm text-white bg-[#e85d5d] rounded-lg">{error}</div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email" className="text-[#2d2d2d] font-medium">Email Address</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="border-[#e5e5e0] focus:border-[#0d7377] focus:ring-[#0d7377]"
              />
            </div>

            <Button
              type="submit"
              className="w-full bg-[#0d7377] hover:bg-[#0a5c5f] text-white font-medium py-2.5 rounded-lg transition-colors"
              disabled={loading}
            >
              {loading ? "Sending..." : "Send Reset Link"}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Remember your password?{" "}
              <Link href="/login" className="text-[#0d7377] hover:underline font-medium">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
