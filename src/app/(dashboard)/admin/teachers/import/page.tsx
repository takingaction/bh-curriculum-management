"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface CSVRow {
  first_name: string;
  last_name: string;
  email: string;
  primary_discipline: string;
  enrollments: string;
  district: string;
  active_status: string;
}

interface ImportResult {
  success: boolean;
  row: number;
  email: string;
  error?: string;
}

export default function ImportTeachersPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ImportResult[] | null>(null);
  const [summary, setSummary] = useState<{ total: number; imported: number; failed: number } | null>(null);
  const [error, setError] = useState("");
  const [csvData, setCsvData] = useState<CSVRow[] | null>(null);

  const parseCSV = (text: string): CSVRow[] => {
    const lines = text.trim().split("\n");
    if (lines.length < 2) return [];

    const headers = lines[0].toLowerCase().split(",").map(h => h.trim());
    const rows: CSVRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(",").map(v => v.trim());
      if (values.length < headers.length) continue;

      const row: Partial<CSVRow> = {};
      headers.forEach((header, index) => {
        const value = values[index] || "";
        switch (header) {
          case "first_name":
          case "firstname":
          case "first name":
            row.first_name = value;
            break;
          case "last_name":
          case "lastname":
          case "last name":
            row.last_name = value;
            break;
          case "email":
            row.email = value;
            break;
          case "primary_discipline":
          case "primarydiscipline":
          case "discipline":
            row.primary_discipline = value;
            break;
          case "enrollments":
            row.enrollments = value;
            break;
          case "district":
          case "district_name":
          case "districtname":
            row.district = value;
            break;
          case "active_status":
          case "activestatus":
          case "active?":
          case "active":
            row.active_status = value;
            break;
        }
      });

      if (row.first_name && row.last_name && row.email) {
        rows.push(row as CSVRow);
      }
    }

    return rows;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const data = parseCSV(text);
      setCsvData(data);
      setResults(null);
      setSummary(null);
      setError("");
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!csvData || csvData.length === 0) {
      setError("No valid data to import");
      return;
    }

    setLoading(true);
    setError("");
    setResults(null);

    try {
      const res = await fetch("/api/admin/teachers/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csvData }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Import failed");
        setLoading(false);
        return;
      }

      setResults(data.results);
      setSummary({
        total: data.total,
        imported: data.imported,
        failed: data.failed,
      });
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setCsvData(null);
    setResults(null);
    setSummary(null);
    setError("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-[#2d2d2d]">Import Teachers from CSV</h2>
        <p className="text-[#666666]">Bulk import teacher accounts using a CSV file</p>
      </div>

      <Card className="border-[#e5e5e0] shadow-sm mb-8">
        <CardHeader>
          <CardTitle className="text-[#2d2d2d]">CSV Format</CardTitle>
          <CardDescription>
            Your CSV file should have the following columns:
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="bg-gray-50 p-4 rounded-md font-mono text-sm overflow-x-auto">
            <p>first_name,last_name,email,primary_discipline,enrollments,district,active_status</p>
            <p className="mt-2 text-gray-600">Example:</p>
            <p>Jane,Doe,jane@school.com,MUSIC,ALL,Oakland USD,yes</p>
            <p>John,Smith,john@school.com,THEATRE,THEATRE,Bay Area SD,trial</p>
            <p>Mary,Jones,mary@school.com,DANCE,MUSIC_GRADE_TK;MUSIC_GRADE_K,City SD,no</p>
          </div>
          <div className="mt-4 text-sm text-gray-600">
            <p><strong>primary_discipline:</strong> N/A, MUSIC, THEATRE, or DANCE</p>
            <p><strong>enrollments:</strong> Semicolon-separated list (e.g., ALL or MUSIC;MUSIC_GRADE_TK)</p>
            <p><strong>active_status:</strong> yes/true/1 = active, no/false/0 = inactive, trial/empty = trial</p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-[#e5e5e0] shadow-sm mb-8">
        <CardHeader>
          <CardTitle className="text-[#2d2d2d]">Upload CSV File</CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-[#0d7377] file:text-white hover:file:bg-[#0a5c5f]"
              />
            </div>

            {csvData && (
              <div className="mt-4 p-4 bg-green-50 rounded-md">
                <p className="text-sm text-green-800">
                  Found {csvData.length} teacher(s) to import
                </p>
                <div className="mt-2 max-h-48 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left">
                        <th className="pr-4">Name</th>
                        <th className="pr-4">Email</th>
                        <th className="pr-4">Discipline</th>
                        <th className="pr-4">Enrollments</th>
                        <th className="pr-4">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {csvData.slice(0, 10).map((row, i) => (
                        <tr key={i} className="border-t">
                          <td className="pr-4 py-1">{row.first_name} {row.last_name}</td>
                          <td className="pr-4 py-1">{row.email}</td>
                          <td className="pr-4 py-1">{row.primary_discipline || "N/A"}</td>
                          <td className="pr-4 py-1">{row.enrollments || "ALL"}</td>
                          <td className="pr-4 py-1">{row.active_status || "trial"}</td>
                        </tr>
                      ))}
                      {csvData.length > 10 && (
                        <tr className="border-t">
                          <td colSpan={5} className="py-1 text-gray-500">
                            ...and {csvData.length - 10} more
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {error && (
              <div className="p-3 text-sm text-red-600 bg-red-50 rounded-md">{error}</div>
            )}

            <div className="flex gap-4">
              <Button
                onClick={handleImport}
                disabled={!csvData || csvData.length === 0 || loading}
                className="bg-[#0d7377] hover:bg-[#0a5c5f]"
              >
                {loading ? "Importing..." : "Import Teachers"}
              </Button>
              {csvData && (
                <Button
                  variant="outline"
                  onClick={handleReset}
                  className="border-[#e5e5e0]"
                >
                  Clear
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {results && summary && (
        <Card className="border-[#e5e5e0] shadow-sm">
          <CardHeader>
            <CardTitle className="text-[#2d2d2d]">Import Results</CardTitle>
            <CardDescription>
              {summary.imported} imported successfully, {summary.failed} failed
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="max-h-64 overflow-y-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b">
                    <th className="pb-2">Row</th>
                    <th className="pb-2">Email</th>
                    <th className="pb-2">Status</th>
                    <th className="pb-2">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((result, i) => (
                    <tr key={i} className={`border-b ${result.success ? "" : "bg-red-50"}`}>
                      <td className="py-2 pr-4">{result.row}</td>
                      <td className="py-2 pr-4">{result.email}</td>
                      <td className="py-2 pr-4">
                        {result.success ? (
                          <span className="text-green-600">Success</span>
                        ) : (
                          <span className="text-red-600">Failed</span>
                        )}
                      </td>
                      <td className="py-2 pr-4 text-gray-600">{result.error || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex gap-4">
              <Button
                variant="outline"
                onClick={() => router.push("/admin/teachers")}
                className="border-[#e5e5e0]"
              >
                View Teachers
              </Button>
              <Button
                variant="outline"
                onClick={handleReset}
                className="border-[#e5e5e0]"
              >
                Import More
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
