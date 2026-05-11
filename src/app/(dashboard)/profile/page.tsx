"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
}

export default function ProfilePage() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [fullName, setFullName] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function fetchProfile() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          router.push("/login");
          return;
        }

        const response = await fetch("/api/profile");
        const data = await response.json();
        console.log("Profile API response:", data);
        if (data.profile) {
          setProfile(data.profile);
          setFullName(data.profile.full_name || "");
        } else if (data.error) {
          console.error("Profile API error:", data.error);
        }
      } catch (err) {
        console.error("Fetch profile error:", err);
      }
      setLoading(false);
    }
    fetchProfile();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage("");

    const { error } = await supabase
      .from("profiles")
      .update({ full_name: fullName })
      .eq("id", profile?.id);

    if (error) {
      setMessage("Error saving profile");
    } else {
      setMessage("Profile saved successfully!");
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl text-[#0d7377]">My Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-[#2d2d2d]">Email</Label>
              <Input
                id="email"
                type="email"
                value={profile?.email || ""}
                disabled
                className="bg-gray-100 border-[#e5e5e0]"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="fullName" className="text-[#2d2d2d]">Full Name</Label>
              <Input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Enter your full name"
                className="border-[#e5e5e0] focus:border-[#0d7377]"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="role" className="text-[#2d2d2d]">Role</Label>
              <Input
                id="role"
                type="text"
                value={profile?.role || ""}
                disabled
                className="bg-gray-100 border-[#e5e5e0] capitalize"
              />
            </div>

            {message && (
              <p className={`text-sm ${message.includes("Error") ? "text-red-600" : "text-green-600"}`}>
                {message}
              </p>
            )}

            <Button
              type="submit"
              disabled={saving}
              className="bg-[#0d7377] hover:bg-[#0a5c5f] text-white"
            >
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}