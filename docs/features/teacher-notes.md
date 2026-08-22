# Teacher Notes Feature

## Overview
Per-user notes functionality for courses and lessons, allowing teachers to save personal notes tied to their profile.

## Database
Two new tables with RLS policies:
- `teacher_course_notes` - Notes per course per teacher
- `teacher_lesson_notes` - Notes per lesson per teacher

Each teacher's notes are private - only accessible by that teacher (and admins via service role).

## API
`GET/PUT /api/teachers/notes`
- Query params: `type` (course|lesson), `courseId`, `lessonId`
- Returns/saves HTML content from TipTap editor

## UI
- **Course view**: "Teacher Notes" link below Course Scope & Sequence
- **Lesson view**: "Teacher Notes" button in right sidebar
- Both open a modal with TipTap editor, Copy, and DOCX download buttons

## Components
- `TeacherNotesModal` - Shared modal component with TipTap editor
- Toolbar: Bold, Italic, H3, Bullet List, Numbered List, Link
- Copy button copies plain text to clipboard
- DOCX button downloads formatted document

## Files
- `supabase/migrations/028_teacher_notes.sql`
- `src/app/api/teachers/notes/route.ts`
- `src/components/teacher-notes-modal.tsx`
- `src/app/(dashboard)/dashboard/courses/[courseId]/course-client.tsx`
- `src/app/(dashboard)/lessons/[lessonId]/page.tsx`
