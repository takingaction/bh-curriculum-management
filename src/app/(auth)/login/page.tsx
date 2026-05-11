"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
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

    router.push("/admin");
    router.refresh();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f5f5f0]">
      <div className="w-full max-w-md p-8 bg-white rounded-xl shadow-lg">
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
          <div className="space-y-2">
            <Label htmlFor="password" className="text-[#2d2d2d] font-medium">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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
        </form>
        <p className="mt-6 text-center text-sm text-[#666666]">
          Contact your administrator if you need access.
        </p>
      </div>
    </div>
  );
}
