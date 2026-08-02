"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Header from "@/components/home/Header";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
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

  if (magicLinkSent) {
    return (
      <>
        <Header />
        <div className="min-h-screen bg-[#f5f5f0] flex items-center justify-center">
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
<div className="min-h-screen bg-[#f5f5f0] flex items-center justify-center">
          <div className="w-full max-w-md p-8 bg-white rounded-xl shadow-lg mx-4">
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-bold text-[#0d7377] mb-2">Performers Ready!</h1>
            <p className="text-[#666666]">Curriculum Management Platform</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-6">
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
              {loading ? "Sending..." : "Sign In with Email"}
            </Button>
          </form>
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
