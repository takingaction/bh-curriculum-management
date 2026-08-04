"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import Header from "@/components/home/Header";

export default function BypassPage() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/bypass/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code, newPassword }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to reset password");
        setLoading(false);
        return;
      }

      setSuccess(true);
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <>
        <Header />
        <div className="min-h-screen bg-[#f5f5f0] flex items-start justify-center pt-20">
          <div className="w-full max-w-md p-8 bg-white rounded-xl shadow-lg mx-4 mt-32">
            <div className="mb-8 text-center">
              <h1 className="text-2xl font-bold text-[#0d7377] mb-2">Password Reset!</h1>
              <p className="text-[#666666]">Curriculum Management Platform</p>
            </div>
            <div className="text-center space-y-4">
              <div className="p-4 bg-[#d7ffef] rounded-lg">
                <p className="text-[#2d2d2d]">
                  Your password has been set successfully.
                </p>
              </div>
              <p className="text-sm text-[#666666]">
                You can now sign in with your new password.
              </p>
            </div>
            <div className="mt-6 text-center">
              <Link
                href="/login"
                className="inline-block bg-[#0d7377] hover:bg-[#0a5c5f] text-white font-medium py-2.5 px-6 rounded-lg transition-colors"
              >
                Go to Sign In
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
      <div className="min-h-screen bg-[#f5f5f0] flex items-start justify-center pt-20">
        <div className="w-full max-w-md p-8 bg-white rounded-xl shadow-lg mx-4 mt-20">
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-bold text-[#0d7377] mb-2">Set Your Password</h1>
            <p className="text-[#666666]">Enter the access code provided by your administrator</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-3 text-sm text-white bg-[#e85d5d] rounded-lg">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email" className="text-[#2d2d2d] font-medium">
                Email Address
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@school.edu"
                required
                className="border-[#e5e5e0] focus:border-[#0d7377] focus:ring-[#0d7377]"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="code" className="text-[#2d2d2d] font-medium">
                Access Code
              </Label>
              <Input
                id="code"
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="PR-2026-XXXX"
                required
                className="border-[#e5e5e0] focus:border-[#0d7377] focus:ring-[#0d7377] font-mono tracking-wider"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="newPassword" className="text-[#2d2d2d] font-medium">
                New Password
              </Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimum 6 characters"
                required
                minLength={6}
                className="border-[#e5e5e0] focus:border-[#0d7377] focus:ring-[#0d7377]"
              />
              <p className="text-xs text-gray-400">Must be at least 6 characters</p>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-[#0d7377] hover:bg-[#0a5c5f] text-white font-medium py-2.5 rounded-lg transition-colors"
            >
              {loading ? "Setting Password..." : "Set Password"}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-[#666666]">
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
