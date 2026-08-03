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
  first_name: string | null;
  last_name: string | null;
  role: string;
}

export default function ProfilePage() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [message, setMessage] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

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
          setFirstName(data.profile.first_name || "");
          setLastName(data.profile.last_name || "");
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
      .update({ first_name: firstName, last_name: lastName })
      .eq("id", profile?.id);

    if (error) {
      setMessage("Error saving profile");
    } else {
      setMessage("Profile saved successfully!");
    }
    setSaving(false);
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMessage("");

    if (newPassword.length < 8) {
      setPasswordMessage("Password must be at least 8 characters");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordMessage("Passwords do not match");
      return;
    }

    setChangingPassword(true);

    try {
      const res = await fetch("/api/profile/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword }),
      });

      const data = await res.json();

      if (!res.ok) {
        setPasswordMessage(data.error || "Failed to update password");
      } else {
        setPasswordMessage("Password updated successfully!");
        setNewPassword("");
        setConfirmPassword("");
      }
    } catch {
      setPasswordMessage("Failed to update password");
    }

    setChangingPassword(false);
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

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName" className="text-[#2d2d2d]">First Name</Label>
                <Input
                  id="firstName"
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Enter your first name"
                  className="border-[#e5e5e0] focus:border-[#0d7377]"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="lastName" className="text-[#2d2d2d]">Last Name</Label>
                <Input
                  id="lastName"
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Enter your last name"
                  className="border-[#e5e5e0] focus:border-[#0d7377]"
                />
              </div>
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

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-xl text-[#0d7377]">Set Password</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500 mb-4">
            Set a password to log in without needing a magic link. You can use either password or magic link to sign in.
          </p>
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newPassword" className="text-[#2d2d2d]">New Password</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                className="border-[#e5e5e0] focus:border-[#0d7377]"
              />
              <p className="text-xs text-gray-500 mt-1">
                Password must be at least 8 characters with lowercase, uppercase, digits, and symbols.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-[#2d2d2d]">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                className="border-[#e5e5e0] focus:border-[#0d7377]"
              />
            </div>

            {passwordMessage && (
              <p className={`text-sm ${passwordMessage.includes("Error") || passwordMessage.includes("not match") || passwordMessage.includes("must be") ? "text-red-600" : "text-green-600"}`}>
                {passwordMessage}
              </p>
            )}

            <Button
              type="submit"
              disabled={changingPassword || !newPassword || !confirmPassword}
              className="bg-[#e37c64] hover:bg-[#c96955] text-white"
            >
              {changingPassword ? "Updating..." : "Update Password"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}