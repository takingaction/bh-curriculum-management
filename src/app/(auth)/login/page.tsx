"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import Header from "@/components/home/Header";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [loginMethod, setLoginMethod] = useState<"magiclink" | "password">("password");
  const supabase = createClient();

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setMagicLinkSent(true);
    setLoading(false);
  };

  const handlePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    window.location.href = "/dashboard";
  };

  if (magicLinkSent) {
    return (
      <>
        <Header />
        <div className="min-h-screen bg-[#f5f5f0] flex items-start justify-center" style={{ paddingTop: '200px' }}>
          <div className="w-full max-w-md p-8 bg-white rounded-xl shadow-lg mx-4">
            <div className="mb-8 text-center">
              <h1 className="text-2xl font-bold text-[#0d7377] mb-2">Performers Ready!</h1>
              <p className="text-[#666666]">Curriculum Management Platform</p>
            </div>
            <div className="text-center space-y-4">
              <div className="p-4 bg-[#d7ffef] rounded-lg">
                <p className="text-[#2d2d2d]">
                  Check your email <strong>{email}</strong> for your sign-in link.
                </p>
              </div>
              <p className="text-sm text-[#666666]">
                Click the link in the email to sign in to your account.
              </p>
              <button
                onClick={() => {
                  setMagicLinkSent(false);
                  setEmail("");
                  setError("");
                }}
                className="text-[#0d7377] hover:text-[#0a5c5f] text-sm font-medium"
              >
                Use a different email
              </button>
            </div>
            <div className="mt-6 text-center">
              <p className="text-sm text-[#666666]">
                New here?{" "}
                <Link href="/signup" className="text-[#0d7377] hover:underline font-medium">
                  Start a free trial
                </Link>
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
        <div className="min-h-screen bg-[#f5f5f0] flex items-start justify-center" style={{ paddingTop: '200px' }}>
          <div className="w-full max-w-md p-8 bg-white rounded-xl shadow-lg mx-4">
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-bold text-[#0d7377] mb-2">Performers Ready!</h1>
            <p className="text-[#666666]">Curriculum Management Platform</p>
          </div>

          <div className="flex gap-2 mb-6">
            <button
              type="button"
              onClick={() => setLoginMethod("password")}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
                loginMethod === "password"
                  ? "bg-[#0d7377] text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              Password
            </button>
            <button
              type="button"
              onClick={() => setLoginMethod("magiclink")}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
                loginMethod === "magiclink"
                  ? "bg-[#0d7377] text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              Magic Link
            </button>
          </div>

          {loginMethod === "password" ? (
            <form onSubmit={handlePassword} className="space-y-6">
              {error && (
                <div className="p-3 text-sm text-white bg-[#e85d5d] rounded-lg">{error}</div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-[#2d2d2d] font-medium">Email</Label>
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
              <div className="space-y-2">
                <Label htmlFor="password" className="text-[#2d2d2d] font-medium">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  className="border-[#e5e5e0] focus:border-[#0d7377] focus:ring-[#0d7377]"
                />
              </div>
              <Button
                type="submit"
                className="w-full bg-[#0d7377] hover:bg-[#0a5c5f] text-white font-medium py-2.5 rounded-lg transition-colors"
                disabled={loading}
              >
                {loading ? "Signing in..." : "Sign In"}
              </Button>
              <p className="text-xs text-[#666666] text-center">
                Forgot your password? Log in with a magic link and update your password in your profile area.
              </p>
            </form>
          ) : (
            <form onSubmit={handleMagicLink} className="space-y-6">
              {error && (
                <div className="p-3 text-sm text-white bg-[#e85d5d] rounded-lg">{error}</div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-[#2d2d2d] font-medium">Email</Label>
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
                {loading ? "Sending..." : "Send Magic Link"}
              </Button>
            </form>
          )}

          <div className="mt-6 text-center">
            <p className="text-sm text-[#666666]">
              New here?{" "}
              <Link href="/signup" className="text-[#0d7377] hover:underline font-medium">
                Start a free trial
              </Link>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
