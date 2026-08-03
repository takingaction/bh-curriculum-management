"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Eye, FileText, Download } from "lucide-react";
import { TrialPdfModal } from "@/components/trial-pdf-modal";

interface Lesson {
  id: string;
  lesson_number: number;
  title: string;
  total_time: string | null;
}

interface CourseClientProps {
  courseId: string;
  courseName: string;
  discipline: string;
  grade: string;
  lessons: Lesson[];
  userId: string;
}

export default function CourseClient({
  courseId,
  courseName,
  discipline,
  grade,
  lessons,
}: CourseClientProps) {
  const [isTrial, setIsTrial] = useState(false);
  const [showTrialModal, setShowTrialModal] = useState(false);

  useEffect(() => {
    async function checkTrial() {
      try {
        const res = await fetch("/api/profile/check-status");
        if (res.ok) {
          const data = await res.json();
          const profile = data.profile;
          if (profile) {
            const isInactive = profile.enrollment_status === "inactive" ||
              (profile.enrollment_status === "trial" && profile.trial_ends_at && new Date(profile.trial_ends_at) < new Date());
            setIsTrial(isInactive);
          }
        }
      } catch (err) {
        console.error("Error checking trial status:", err);
      }
    }
    checkTrial();
  }, []);

  const handlePdfClick = (e: React.MouseEvent, download: boolean) => {
    if (isTrial) {
      e.preventDefault();
      setShowTrialModal(true);
    }
  };

  return (
    <>
      <div className="mb-8">
        <h2 className="text-2xl font-bold">{courseName}</h2>
        <p className="text-gray-600">
          {discipline} · Grade {grade}
        </p>
      </div>

      <div className="bg-white border border-[#e5e5e0] rounded-lg">
        <div className="px-6 py-4 border-b border-[#e5e5e0]">
          <h3 className="text-lg font-semibold text-[#2d2d2d]">Lessons ({lessons?.length || 0})</h3>
        </div>
        {lessons && lessons.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lessons.map((lesson) => (
                <TableRow key={lesson.id}>
                  <TableCell>{lesson.lesson_number}</TableCell>
                  <TableCell>{lesson.title}</TableCell>
                  <TableCell>{lesson.total_time || "-"}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Link href={`/lessons/${lesson.id}`}>
                        <Button variant="outline" size="sm" className="text-xs text-[#0d7377] border-[#e5e5e0] hover:bg-[#d7ffef]">
                          <Eye className="w-3 h-3 mr-1" />
                          View Lesson
                        </Button>
                      </Link>
                      <a
                        href={`/api/lessons/${lesson.id}/pdf?download=false`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => handlePdfClick(e, false)}
                      >
                        <Button variant="outline" size="sm" className="text-xs text-[#0d7377] border-[#e5e5e0] hover:bg-[#d7ffef]">
                          <FileText className="w-3 h-3 mr-1" />
                          View PDF
                        </Button>
                      </a>
                      <a
                        href={`/api/lessons/${lesson.id}/pdf?download=true`}
                        download
                        onClick={(e) => handlePdfClick(e, true)}
                      >
                        <Button variant="outline" size="sm" className="text-xs text-[#0d7377] border-[#e5e5e0] hover:bg-[#d7ffef]">
                          <Download className="w-3 h-3 mr-1" />
                          Download PDF
                        </Button>
                      </a>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="px-6 py-8 text-center text-gray-500">
            No lessons in this course
          </div>
        )}
      </div>

      <TrialPdfModal
        open={showTrialModal}
        onClose={() => setShowTrialModal(false)}
      />
    </>
  );
}
