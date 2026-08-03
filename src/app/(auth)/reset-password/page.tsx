"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Header from "@/components/home/Header";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [success, setSuccess] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || (session && session.user)) {
        setReady(true);
      }
    });

    // Check for existing session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setReady(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);

    const { data, error: updateError } = await supabase.auth.updateUser({
      password,
    });

    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);

    setTimeout(() => {
      window.location.href = "/dashboard";
    }, 1500);
  };

  if (success) {
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
                <p className="text-[#2d2d2d]">Password updated successfully!</p>
              </div>
              <p className="text-sm text-gray-500">
                Redirecting you to the dashboard...
              </p>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (!ready) {
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
              <p className="text-gray-500">
                This page is only accessible via a password reset link from your email.
              </p>
              <p className="text-sm text-gray-400">
                If you need to reset your password,{" "}
                <a href="/forgot-password" className="text-[#0d7377] hover:underline">
                  request a new reset link
                </a>
                .
              </p>
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
            <h1 className="text-2xl font-bold text-[#0d7377] mb-2">Set New Password</h1>
            <p className="text-[#666666]">Enter your new password below</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-3 text-sm text-white bg-[#e85d5d] rounded-lg">{error}</div>
            )}

            <div className="space-y-2">
              <Label htmlFor="password" className="text-[#2d2d2d] font-medium">New Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                required
                minLength={6}
                className="border-[#e5e5e0] focus:border-[#0d7377] focus:ring-[#0d7377]"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-[#2d2d2d] font-medium">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm your password"
                required
                minLength={6}
                className="border-[#e5e5e0] focus:border-[#0d7377] focus:ring-[#0d7377]"
              />
            </div>

            <Button
              type="submit"
              className="w-full bg-[#0d7377] hover:bg-[#0a5c5f] text-white font-medium py-2.5 rounded-lg transition-colors"
              disabled={loading}
            >
              {loading ? "Updating..." : "Update Password"}
            </Button>
          </form>
        </div>
      </div>
    </>
  );
}
