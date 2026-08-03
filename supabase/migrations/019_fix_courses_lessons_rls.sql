-- Migration: 019_fix_courses_lessons_rls.sql
-- Fix RLS policies after dropping teacher_assignments table
-- Since filtering is done at application level via profile.enrollments,
-- we allow all authenticated users to read courses and lessons

-- Drop old policies that reference teacher_assignments
DROP POLICY IF EXISTS "Teachers read assigned courses" ON public.courses;
DROP POLICY IF EXISTS "Teachers read lessons in assigned courses" ON public.lessons;

-- Create new policy: all authenticated users can read courses (filtering done in app)
CREATE POLICY "Authenticated users read courses" ON public.courses
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Create new policy: all authenticated users can read lessons (filtering done in app)
CREATE POLICY "Authenticated users read lessons" ON public.lessons
  FOR SELECT USING (auth.uid() IS NOT NULL);
