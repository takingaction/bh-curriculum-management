"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EnrollmentsSelect } from "@/components/enrollments-select";

const DISCIPLINES = [
  { value: "N/A", label: "N/A" },
  { value: "MUSIC", label: "Music" },
  { value: "THEATRE", label: "Theatre" },
  { value: "DANCE", label: "Dance" },
];

const ENROLLMENT_STATUSES = [
  { value: "trial", label: "Trial" },
  { value: "active", label: "Yes (Active)" },
  { value: "inactive", label: "No (Inactive)" },
];

export default function OnboardTeacherPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    email: "",
    california: true,
    district_name: "",
    primary_discipline: "N/A",
    enrollment_status: "trial",
    enrollments: ["ALL"],
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (type === "checkbox") {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleEnrollmentsChange = (enrollments: string[]) => {
    setFormData(prev => ({ ...prev, enrollments }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!formData.first_name.trim() || !formData.last_name.trim()) {
      setError("First name and last name are required");
      return;
    }

    if (!formData.email.trim()) {
      setError("Email is required");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/admin/teachers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: formData.first_name.trim(),
          last_name: formData.last_name.trim(),
          email: formData.email.trim(),
          california: formData.california,
          district_name: formData.district_name.trim() || null,
          primary_discipline: formData.primary_discipline,
          enrollment_status: formData.enrollment_status,
          enrollments: formData.enrollments,
          role: "teacher",
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to create teacher");
        setLoading(false);
        return;
      }

      setSuccess("Teacher created successfully!");
      
      setLoading(false);
      
      setTimeout(() => {
        router.push("/admin/teachers");
      }, 1500);
    } catch {
      setError("An unexpected error occurred");
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-[#2d2d2d]">Onboard New Teacher</h2>
        <p className="text-[#666666]">Create a new teacher account and set their access level</p>
      </div>

      <Card className="border-[#e5e5e0] shadow-sm">
        <CardHeader>
          <CardTitle className="text-[#2d2d2d]">Teacher Information</CardTitle>
          <CardDescription>Enter the teacher&apos;s details and access settings</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-3 text-sm text-red-600 bg-red-50 rounded-md">{error}</div>
            )}
            {success && (
              <div className="p-3 text-sm text-green-600 bg-green-50 rounded-md">{success}</div>
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

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="district_name">District Name</Label>
                <Input
                  id="district_name"
                  name="district_name"
                  type="text"
                  value={formData.district_name}
                  onChange={handleChange}
                  placeholder="Oakland Unified School District"
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
            </div>

            <div className="flex items-start gap-3">
              <input
                id="california"
                name="california"
                type="checkbox"
                checked={formData.california}
                onChange={handleChange}
                className="mt-1 h-4 w-4 rounded border-gray-300 text-[#0d7377] focus:ring-[#0d7377]"
              />
              <div className="text-sm">
                <Label htmlFor="california" className="font-medium cursor-pointer">
                  California Standards
                </Label>
                <p className="text-gray-500">
                  If checked, teacher will see VAPA standards. If unchecked, they will see NCAS standards. However, PDF will show both for the time being.
                </p>
              </div>
            </div>

            <div className="border-t pt-6">
              <h3 className="text-lg font-semibold text-[#2d2d2d] mb-4">Access Settings</h3>

              <div className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="enrollment_status">Active Status</Label>
                  <select
                    id="enrollment_status"
                    name="enrollment_status"
                    value={formData.enrollment_status}
                    onChange={handleChange}
                    className="w-full h-10 px-3 border border-[#e5e5e0] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#0d7377] focus:border-transparent"
                  >
                    {ENROLLMENT_STATUSES.map(s => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500">
                    Trial accounts last 14 days. Active = full access. Inactive = cannot log in.
                  </p>
                </div>

                <div className="space-y-3">
                  <Label>Enrollments (Course Access)</Label>
                  <EnrollmentsSelect
                    value={formData.enrollments}
                    onChange={handleEnrollmentsChange}
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-4 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
                className="border-[#e5e5e0]"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="bg-[#0d7377] hover:bg-[#0a5c5f]"
              >
                {loading ? "Creating..." : "Create Teacher"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
