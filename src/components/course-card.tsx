import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface CourseCardProps {
  id: string;
  title: string;
  discipline: string;
  grade: string;
  imageUrl?: string | null;
  lessonCount: number;
}

export function CourseCard({ id, title, discipline, grade, imageUrl, lessonCount }: CourseCardProps) {
  return (
    <Card className="border-[#e5e5e0] shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col h-full animate-fadeIn rounded-t-none !pt-0 gap-0">
      <div className="aspect-video bg-[#f5f5f0] relative rounded-t-none">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#e37c64] to-[#e5a23a]">
            <span className="text-white text-4xl font-bold opacity-50">
              {title.charAt(0)}
            </span>
          </div>
        )}
      </div>
      <CardHeader className="pb-2 flex-shrink-0 rounded-t-none !pt-4">
        <CardTitle className="text-lg leading-tight">{title}</CardTitle>
        <p className="text-sm text-gray-500">
          Grade {grade} · {lessonCount} {lessonCount === 1 ? "lesson" : "lessons"}
        </p>
      </CardHeader>
      <CardContent className="pt-0 flex flex-col flex-grow justify-end">
        <Link href={`/dashboard/courses/${id}`} className="mt-auto">
          <Button className="w-full bg-[#0d7377] hover:bg-[#0a5c5f] text-white">
            View Lessons
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
