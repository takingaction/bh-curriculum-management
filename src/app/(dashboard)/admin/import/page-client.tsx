"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import Papa from "papaparse";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";

interface ParsedRow {
  Discipline: string;
  Grade: string;
  "Course Title": string;
  "Lesson Number": string;
  LessonName: string;
  "Total Time": string;
  [key: string]: string;
}

export default function ImportPage() {
  const [csvData, setCsvData] = useState<ParsedRow[]>([]);
  const [courseInfo, setCourseInfo] = useState({ title: "", discipline: "", grade: "" });
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState({ success: 0, errors: 0, errorMessages: [] as string[] });
  const [step, setStep] = useState<"upload" | "preview" | "confirm" | "importing" | "done">("upload");

  const checkCourseExists = async (title: string, discipline: string, grade: string) => {
    try {
      const response = await fetch("/api/admin/courses/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, discipline, grade }),
      });
      const data = await response.json();
      return data.exists ? data.courseId : null;
    } catch {
      return null;
    }
  };

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const data = results.data as ParsedRow[];
        setCsvData(data);

        if (data.length > 0) {
          const firstRow = data[0];
          const info = {
            title: firstRow["Course Title"] || "",
            discipline: firstRow.Discipline || "",
            grade: firstRow.Grade || "",
          };
          setCourseInfo(info);

          const existingCourseId = await checkCourseExists(info.title, info.discipline, info.grade);
          if (existingCourseId) {
            setStep("confirm");
          } else {
            setStep("preview");
          }
        }
      },
      error: (error) => {
        console.error("CSV parse error:", error);
      },
    });
  }, []);

  const fieldMappings: Record<string, string> = {
    LessonName: "title",
    "Total Time": "total_time",
    "Lesson Outline": "lesson_outline",
    "Learning Objectives": "learning_objectives",
    Vocabulary: "vocabulary",
    Materials: "materials",
    Vapa_Text_Block: "vapa_text_block",
    NCAS_Text_Block: "ncas_text_block",
    WelcomeOpening: "welcome_opening",
    "Actual Class Expectations Procedures": "actual_class_expectations",
    "Lesson Hook": "lesson_hook",
    "Warm up": "warm_up",
    "Main Activity": "main_activity",
    "Instrument Expectations Procedures": "instrument_expectations",
    Reflection: "reflection",
    "Closing Ceremony": "closing_ceremony",
    Assessment: "assessment",
  };

  const handleImport = async () => {
    setImporting(true);
    setStep("importing");
    setProgress(0);
    setResults({ success: 0, errors: 0, errorMessages: [] });

    try {
      const response = await fetch("/api/admin/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseInfo, csvData, fieldMappings }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error("Import error:", data.error);
        setImporting(false);
        return;
      }

      setProgress(100);
      setResults({
        success: data.results.success,
        errors: data.results.errors,
        errorMessages: data.results.errorMessages || []
      });
      setImporting(false);
      setStep("done");
    } catch (error) {
      console.error("Import failed:", error);
      setImporting(false);
    }
  };

  const resetImport = () => {
    setCsvData([]);
    setCourseInfo({ title: "", discipline: "", grade: "" });
    setProgress(0);
    setResults({ success: 0, errors: 0, errorMessages: [] });
    setStep("upload");
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h2 className="text-2xl font-bold">Import CSV</h2>
        <p className="text-gray-600">Import lessons from a CSV file</p>
      </div>

      {step === "upload" && (
        <Card>
          <CardHeader>
            <CardTitle>Upload CSV File</CardTitle>
          </CardHeader>
          <CardContent>
            <input
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
          </CardContent>
        </Card>
      )}

      {step === "preview" && (
        <>
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Course Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Title</p>
                  <p className="font-medium">{courseInfo.title}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Discipline</p>
                  <p className="font-medium">{courseInfo.discipline}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Grade</p>
                  <p className="font-medium">{courseInfo.grade}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Preview ({csvData.length} lessons)</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Lesson Name</TableHead>
                    <TableHead>Duration</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {csvData.slice(0, 10).map((row, i) => (
                    <TableRow key={i}>
                      <TableCell>{row["Lesson Number"] || i + 1}</TableCell>
                      <TableCell>{row.LessonName}</TableCell>
                      <TableCell>{row["Total Time"] || "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {csvData.length > 10 && (
                <p className="text-sm text-gray-500 mt-4">
                  ...and {csvData.length - 10} more lessons
                </p>
              )}
            </CardContent>
          </Card>

          <div className="flex gap-4">
            <Button onClick={handleImport}>Import {csvData.length} Lessons</Button>
            <Button variant="outline" onClick={resetImport}>
              Cancel
            </Button>
          </div>
        </>
      )}

      {step === "confirm" && (
        <>
          <Card className="mb-6 border-2 border-yellow-400">
            <CardHeader>
              <CardTitle className="text-yellow-700">Re-import Warning</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4">
                A course with the same name, discipline, and grade already exists:
              </p>
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div>
                  <p className="text-sm text-gray-500">Title</p>
                  <p className="font-medium">{courseInfo.title}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Discipline</p>
                  <p className="font-medium">{courseInfo.discipline}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Grade</p>
                  <p className="font-medium">{courseInfo.grade}</p>
                </div>
              </div>
              <p className="text-yellow-700 font-medium">
                Importing will replace existing lessons with the new CSV content.
              </p>
            </CardContent>
          </Card>

          <Card className="mb-6">
            <CardHeader>
              <CardTitle>New CSV Content ({csvData.length} lessons)</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Lesson Name</TableHead>
                    <TableHead>Duration</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {csvData.slice(0, 10).map((row, i) => (
                    <TableRow key={i}>
                      <TableCell>{row["Lesson Number"] || i + 1}</TableCell>
                      <TableCell>{row.LessonName}</TableCell>
                      <TableCell>{row["Total Time"] || "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {csvData.length > 10 && (
                <p className="text-sm text-gray-500 mt-4">
                  ...and {csvData.length - 10} more lessons
                </p>
              )}
            </CardContent>
          </Card>

          <div className="flex gap-4">
            <Button onClick={handleImport} className="bg-yellow-600 hover:bg-yellow-700">
              Replace Existing Lessons
            </Button>
            <Button variant="outline" onClick={resetImport}>
              Cancel
            </Button>
          </div>
        </>
      )}

      {step === "importing" && (
        <Card>
          <CardHeader>
            <CardTitle>Importing...</CardTitle>
          </CardHeader>
          <CardContent>
            <Progress value={progress} className="mb-4" />
            <p className="text-center">
              {progress}% complete
            </p>
            <p className="text-center text-sm text-gray-500 mt-2">
              {results.success} imported, {results.errors} errors
            </p>
          </CardContent>
        </Card>
      )}

      {step === "done" && (
        <Card>
          <CardHeader>
            <CardTitle>Import Complete</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex gap-4">
                <Badge variant="default">{results.success} Imported</Badge>
                {results.errors > 0 && (
                  <Badge variant="destructive">{results.errors} Errors</Badge>
                )}
              </div>
              {results.errorMessages.length > 0 && (
                <div className="mt-4 p-4 bg-red-50 rounded text-sm text-red-800 max-h-40 overflow-y-auto">
                  <p className="font-semibold mb-2">Error Details:</p>
                  <ul className="list-disc pl-4">
                    {results.errorMessages.map((msg, i) => (
                      <li key={i}>{msg}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="flex gap-4">
                <Button onClick={resetImport}>Import Another</Button>
                <Link href="/admin/courses">
                  <Button variant="outline">View Courses</Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
