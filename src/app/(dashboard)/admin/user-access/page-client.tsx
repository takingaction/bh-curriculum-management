"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface BypassCode {
  id: string;
  code: string;
  email: string;
  created_at: string;
  expires_at: string;
  used_at: string | null;
  creator: {
    email: string;
    full_name: string | null;
  } | null;
}

export default function UserAccessPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [codes, setCodes] = useState<BypassCode[]>([]);
  const [codesLoading, setCodesLoading] = useState(true);
  const [todayCount, setTodayCount] = useState(0);

  useEffect(() => {
    fetchCodes();
  }, []);

  async function fetchCodes() {
    try {
      const res = await fetch("/api/admin/bypass-codes");
      const data = await res.json();

      if (!res.ok) {
        console.error("Failed to fetch codes:", data.error);
        return;
      }

      setCodes(data.codes || []);

      const today = new Date().toISOString().split("T")[0];
      const todayCodes = (data.codes || []).filter((c: BypassCode) =>
        c.created_at.startsWith(today)
      );
      setTodayCount(todayCodes.length);
    } catch (err) {
      console.error("Error fetching codes:", err);
    } finally {
      setCodesLoading(false);
    }
  }

  async function handleGenerateCode(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!email.trim()) {
      setError("Email is required");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/admin/bypass-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to generate code");
        setLoading(false);
        return;
      }

      setSuccess(`Code generated: ${data.code}. Share this with the user at /bypass`);
      setEmail("");
      fetchCodes();
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  }

  function getStatusBadge(code: BypassCode) {
    if (code.used_at) {
      return <Badge className="bg-green-600 text-white">Used</Badge>;
    }
    if (new Date(code.expires_at) < new Date()) {
      return <Badge className="bg-red-600 text-white">Expired</Badge>;
    }
    return <Badge className="bg-blue-600 text-white">Unused</Badge>;
  }

  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleString();
  }

  function getCreatorName(code: BypassCode) {
    if (!code.creator) return "Unknown";
    if (code.creator.full_name) return code.creator.full_name;
    return code.creator.email;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-[#2d2d2d]">User Access</h2>
        <p className="text-[#666666]">Generate bypass codes for users who cannot receive emails</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1">
          <Card className="border-[#e5e5e0] shadow-sm">
            <CardHeader>
              <CardTitle className="text-[#2d2d2d]">Generate Access Code</CardTitle>
              <CardDescription>
                Create a temporary code for users to set their password
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <form onSubmit={handleGenerateCode} className="space-y-4">
                {error && (
                  <div className="p-3 text-sm text-red-600 bg-red-50 rounded-md">{error}</div>
                )}
                {success && (
                  <div className="p-3 text-sm text-green-600 bg-green-50 rounded-md whitespace-pre-wrap">{success}</div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="email">User Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="user@school.edu"
                    required
                  />
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[#0d7377] hover:bg-[#0a5c5f]"
                >
                  {loading ? "Generating..." : "Generate Code"}
                </Button>

                <div className="pt-4 border-t">
                  <div className="text-sm text-[#666666]">
                    <span className="font-medium">Daily limit:</span> {todayCount} of 100 codes used today
                  </div>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card className="mt-6 border-[#e5e5e0] shadow-sm">
            <CardHeader>
              <CardTitle className="text-[#2d2d2d] text-base">How It Works</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 text-sm text-[#666666] space-y-3">
              <div>
                <span className="font-medium text-[#2d2d2d]">1.</span> Generate a code for a user email
              </div>
              <div>
                <span className="font-medium text-[#2d2d2d]">2.</span> Share the code and direct them to{" "}
                <code className="bg-gray-100 px-1 rounded text-xs">/bypass</code>
              </div>
              <div>
                <span className="font-medium text-[#2d2d2d]">3.</span> User enters email, code, and new password
              </div>
              <div>
                <span className="font-medium text-[#2d2d2d]">4.</span> Code expires after 48 hours or after use
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card className="border-[#e5e5e0] shadow-sm">
            <CardHeader>
              <CardTitle className="text-[#2d2d2d]">All Access Codes</CardTitle>
              <CardDescription>
                Codes created by all admins ({codes.length} total)
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              {codesLoading ? (
                <div className="text-center py-8 text-[#666666]">Loading...</div>
              ) : codes.length === 0 ? (
                <div className="text-center py-8 text-[#666666]">
                  No codes generated yet
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Email</TableHead>
                        <TableHead>Code</TableHead>
                        <TableHead>Created By</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead>Expires</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {codes.map((code) => (
                        <TableRow key={code.id}>
                          <TableCell className="font-medium">{code.email}</TableCell>
                          <TableCell>
                            <code className="bg-gray-100 px-2 py-0.5 rounded text-sm font-mono">
                              {code.code}
                            </code>
                          </TableCell>
                          <TableCell className="text-[#666666]">
                            {getCreatorName(code)}
                          </TableCell>
                          <TableCell className="text-[#666666] text-sm">
                            {formatDate(code.created_at)}
                          </TableCell>
                          <TableCell className="text-[#666666] text-sm">
                            {formatDate(code.expires_at)}
                          </TableCell>
                          <TableCell>{getStatusBadge(code)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
