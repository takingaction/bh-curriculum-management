"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import Header from "@/components/home/Header";

const DISCIPLINES = [
  { value: "N/A", label: "N/A" },
  { value: "MUSIC", label: "Music" },
  { value: "THEATRE", label: "Theatre" },
  { value: "DANCE", label: "Dance" },
];

export default function SignupPage() {
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    email: "",
    california: true,
    district_name: "",
    primary_discipline: "N/A",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [signupComplete, setSignupComplete] = useState(false);
  const supabase = createClient();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (type === "checkbox") {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!formData.first_name.trim() || !formData.last_name.trim()) {
      setError("First name and last name are required");
      return;
    }

    if (!formData.email.trim()) {
      setError("Email is required");
      return;
    }

    if (!formData.district_name.trim()) {
      setError("District name is required");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/teachers/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: formData.first_name.trim(),
          last_name: formData.last_name.trim(),
          email: formData.email.trim(),
          california: formData.california,
          district_name: formData.district_name.trim(),
          primary_discipline: formData.primary_discipline,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to create account");
        setLoading(false);
        return;
      }

      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: formData.email.trim(),
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (otpError) {
        console.error("Failed to send magic link:", otpError);
      }

      setSignupComplete(true);
      setLoading(false);
    } catch {
      setError("An unexpected error occurred");
      setLoading(false);
    }
  };

  if (signupComplete) {
    return (
      <>
        <Header />
        <div className="min-h-screen bg-gray-50 flex justify-center py-12 px-4" style={{ paddingTop: '180px' }}>
          <Card className="w-full max-w-lg mx-4">
            <CardHeader>
              <CardTitle className="text-2xl">Check Your Email</CardTitle>
              <CardDescription>
                We&apos;ve sent a sign-in link to <strong>{formData.email}</strong>
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="text-center space-y-4">
                <div className="p-4 bg-[#d7ffef] rounded-lg">
                  <p className="text-[#2d2d2d]">
                    Click the link in the email to sign in and start your free trial.
                  </p>
                </div>
                <p className="text-sm text-gray-500">
                  Your trial starts when you first sign in.
                </p>
                <button
                  onClick={() => {
                    setSignupComplete(false);
                    setFormData({
                      first_name: "",
                      last_name: "",
                      email: "",
                      california: true,
                      district_name: "",
                      primary_discipline: "N/A",
                    });
                    setError("");
                  }}
                  className="text-[#0d7377] hover:text-[#0a5c5f] text-sm font-medium"
                >
                  Use a different email
                </button>
              </div>
              <div className="mt-6 text-center">
                <p className="text-sm text-gray-600">
                  Already have an account?{" "}
                  <Link href="/login" className="text-[#0d7377] hover:underline">
                    Sign in
                  </Link>
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </>
    );
  }

  return (
    <>
      <Header />
      <div className="min-h-screen bg-gray-50 flex justify-center py-12 px-4">
        <Card className="w-full max-w-lg mx-4 mt-28">
          <CardHeader>
            <CardTitle className="text-2xl">Start Your Free Trial</CardTitle>
            <CardDescription>
              Create an account to access the Performers Ready! curriculum
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 text-sm text-red-600 bg-red-50 rounded-md">{error}</div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="first_name">First Name *</Label>
                  <Input
                    id="first_name"
                    name="first_name"
                    type="text"
                    value={formData.first_name}
                    onChange={handleChange}
                    placeholder="Jane"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="last_name">Last Name *</Label>
                  <Input
                    id="last_name"
                    name="last_name"
                    type="text"
                    value={formData.last_name}
                    onChange={handleChange}
                    placeholder="Doe"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email Address *</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="jane.doe@school.edu"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="district_name">District Name *</Label>
                <Input
                  id="district_name"
                  name="district_name"
                  type="text"
                  value={formData.district_name}
                  onChange={handleChange}
                  placeholder="Oakland Unified School District"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="primary_discipline">Primary Discipline</Label>
                <select
                  id="primary_discipline"
                  name="primary_discipline"
                  value={formData.primary_discipline}
                  onChange={handleChange}
                  className="w-full h-10 px-3 border border-[#e5e5e0] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#0d7377] focus:border-transparent"
                >
                  {DISCIPLINES.map(d => (
                    <option key={d.value} value={d.value}>{d.label}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <input
                  id="california"
                  name="california"
                  type="checkbox"
                  checked={formData.california}
                  onChange={handleChange}
                  className="h-4 w-4 rounded border-gray-300 text-[#0d7377] focus:ring-[#0d7377]"
                />
                <Label htmlFor="california" className="text-sm font-medium cursor-pointer">
                  I teach in California
                </Label>
              </div>

              <div className="pt-4">
                <Button
                  type="submit"
                  className="w-full bg-[#0d7377] hover:bg-[#0a5c5f]"
                  disabled={loading}
                >
                  {loading ? "Creating account..." : "Start Free Trial"}
                </Button>
              </div>
            </form>

            <div className="mt-6 text-center text-sm text-gray-600">
              <p>
                By signing up, you agree to our Terms of Service and Privacy Policy.
              </p>
              <p className="mt-2">
                Your trial lasts 14 days. No credit card required.
              </p>
            </div>

            <p className="mt-4 text-center text-sm text-gray-600">
              Already have an account?{" "}
              <Link href="/login" className="text-[#0d7377] hover:underline">
                Sign in
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
