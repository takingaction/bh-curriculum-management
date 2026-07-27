# Course Summary and Course Materials

## Overview

Added ability for admins to add a course summary and attach course-wide materials that display on all lesson pages.

## Features

### Course Summary

- New `summary` text field on the course edit page
- Displays below the course title, discipline, and grade inputs
- Simple textarea for plain text input

### Course Materials

- New "Course Materials" section below Spotify Playlist on course edit page
- Admins can add resources from the asset library that apply to all lessons in a course
- Resources are displayed in a separate "Course Materials" section on lesson pages (below "Lesson Materials")
- Supports full drag-drop reordering, preview, download, and removal

## Database Changes

### Migration: `012_add_course_summary_and_course_assets.sql`

- Added `summary TEXT` column to `courses` table
- Created `course_assets` junction table with:
  - `id` (UUID, primary key)
  - `course_id` (UUID, foreign key to courses)
  - `asset_id` (UUID, foreign key to assets)
  - `sort_order` (INTEGER)
  - `created_at` (TIMESTAMPTZ)
  - UNIQUE constraint on (course_id, asset_id)
- RLS policies for admin full access and authenticated user read access

## API Changes

### Updated

- `src/app/api/admin/courses/[id]/route.ts` - Added `summary` field to PUT handler

### New Endpoints

- `GET /api/courses/[courseId]/assets` - Fetch course assets with asset details
- `POST /api/courses/[courseId]/assets` - Add asset to course (auto-assigns sort order)
- `DELETE /api/courses/[courseId]/assets/[assetId]` - Remove asset from course
- `PATCH /api/courses/[courseId]/assets/reorder` - Reorder assets by array of IDs

## Component Changes

### New: `src/components/course-assets-panel.tsx`

- Full-featured assets panel patterned after LessonAssetsPanel
- Sortable drag-drop list using @dnd-kit
- Uses existing AssetLibraryModal for adding resources
- Preview modal for PDFs, videos, and audio files
- Download and remove functionality

### Updated: `src/app/(dashboard)/admin/courses/[id]/page.tsx`

- Added summary textarea to CourseEditForm
- Added CourseAssetsPanel below CourseSpotifySection

### Updated: `src/app/(dashboard)/lessons/[lessonId]/page.tsx`

- Added course assets fetch using `lesson.course_id`
- Added "Course Materials" section below "Lesson Materials" on lesson pages
- Shows up to 6 course materials with preview/download actions
