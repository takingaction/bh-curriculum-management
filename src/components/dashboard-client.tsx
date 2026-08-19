"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CourseCard } from "@/components/course-card";
import VideoDialog from "@/components/video-dialog";
import { AlertTriangle, FileText } from "lucide-react";

const DISCIPLINE_ORDER = ["Music", "Theatre", "Dance"];

interface Course {
  id: string;
  title: string;
  discipline: string;
  grade: string;
  image_url: string | null;
}

interface DashboardClientProps {
  profile: any;
  isAdmin: boolean;
  courses: Course[];
  lessonCounts: Record<string, number>;
  adaptedCount: number;
  isInactive?: boolean;
  isTrial?: boolean;
  trialEndsAt?: string | null;
  disciplinePdfs?: Record<string, { exists: boolean }>;
}

export default function DashboardClient({
  profile,
  isAdmin,
  courses,
  lessonCounts,
  adaptedCount,
  isInactive = false,
  isTrial = false,
  trialEndsAt = null,
  disciplinePdfs = {},
}: DashboardClientProps) {
  const [activeTab, setActiveTab] = useState<string>(
    DISCIPLINE_ORDER.find((d) => courses.some((c) => c.discipline === d)) || "Music"
  );

  const totalLessons = Object.values(lessonCounts).reduce((sum, count) => sum + count, 0);
  const availableDisciplines = DISCIPLINE_ORDER.filter((d) =>
    courses.some((c) => c.discipline === d)
  );
  const activeCourses = courses.filter((c) => c.discipline === activeTab);

  const getDaysRemaining = (endsAt: string): number => {
    const now = new Date();
    const ends = new Date(endsAt);
    const diff = ends.getTime() - now.getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {isTrial && trialEndsAt && (
        <div className="bg-[#e37c64] text-white px-4 py-3 mt-6 rounded-md">
          <p className="text-sm font-medium text-center">
            Your trial ends in {getDaysRemaining(trialEndsAt)} days.{" "}
            <a href="mailto:support@betterhumanseducation.com" target="_blank" rel="noopener noreferrer" className="underline">
              Contact us
            </a>{" "}
            to activate your full account.
          </p>
        </div>
      )}
      {isInactive && !isTrial && (
        <div className="bg-red-600 text-white px-4 py-3 mt-6 rounded-md">
          <p className="text-sm font-medium text-center">
            Your account is no longer active. Please contact{" "}
            <a href="mailto:support@betterhumanseducation.com" target="_blank" rel="noopener noreferrer" className="underline">
              support@betterhumanseducation.com
            </a>{" "}
            to activate your account.
          </p>
        </div>
      )}

      <div className="flex items-center justify-center gap-2 bg-[#e37c64] text-white px-4 py-3 mt-6 rounded-md">
        <AlertTriangle className="w-5 h-5 flex-shrink-0" />
        <p className="text-sm font-medium">
          All Performers Ready materials are protected by copyright and cannot be shared or distributed to any person or entity that does not have an active license.
        </p>
      </div>

      <div className="py-6">
        <VideoDialog />
      </div>

      <div className="mb-8">
        <h2 className="text-2xl font-bold text-[#2d2d2d]">Welcome, {profile?.first_name || profile?.full_name || profile?.email}</h2>
        <p className="text-[#666666]">Your curriculum and teaching resources</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <Card className="border-[#e5e5e0] shadow-sm">
          <CardHeader>
            <CardTitle className="text-4xl font-bold text-[#0d7377]">{courses.length}</CardTitle>
            <CardDescription className="text-[#666666]">{isAdmin ? "Total Courses" : "Assigned Courses"}</CardDescription>
          </CardHeader>
        </Card>
        <Card className="border-[#e5e5e0] shadow-sm">
          <CardHeader>
            <CardTitle className="text-4xl font-bold text-[#0d7377]">
              {totalLessons}
            </CardTitle>
            <CardDescription className="text-[#666666]">Total Lessons</CardDescription>
          </CardHeader>
        </Card>
        {/* <Card className="border-[#e5e5e0] shadow-sm">
          <CardHeader>
            <CardTitle className="text-4xl font-bold text-[#0d7377]">{adaptedCount}</CardTitle>
            <CardDescription className="text-[#666666]">AI Adaptations</CardDescription>
          </CardHeader>
        </Card> */}
      </div>

      <Card className="border-[#e5e5e0] shadow-sm mb-8">
        <CardHeader>
          <CardTitle className="text-[#2d2d2d]">My Courses</CardTitle>
          <CardDescription className="text-[#666666]">Curriculum available to you</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          {courses.length > 0 ? (
            <>
              <div className="flex justify-center mb-8">
                <div className="inline-flex items-center gap-2 p-1.5 bg-[#f5f5f0] rounded-full">
                  {availableDisciplines.map((discipline) => (
                    <button
                      key={discipline}
                      onClick={() => setActiveTab(discipline)}
                      className={`px-6 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                        activeTab === discipline
                          ? "bg-[#0d7377] text-white shadow-sm"
                          : "text-[#666666] hover:text-[#2d2d2d] hover:bg-white/50"
                      }`}
                    >
                      {discipline}
                    </button>
                  ))}
                </div>
              </div>

              <div key={activeTab}>
                <a
                  href={`/api/disciplines/${activeTab}/pdf`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#0d7377] hover:underline flex items-center gap-2 text-sm mb-4"
                >
                  <FileText className="w-4 h-4" />
                  Courses Scope & Sequence
                </a>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {activeCourses.map((course) => (
                    <CourseCard
                      key={course.id}
                      id={course.id}
                      title={course.title}
                      discipline={course.discipline}
                      grade={course.grade}
                      imageUrl={course.image_url}
                      lessonCount={lessonCounts[course.id] || 0}
                    />
                  ))}
                </div>
              </div>
            </>
          ) : (
            <p className="text-[#666666]">
              No courses assigned yet. Contact an administrator.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
