-- Migration: 018_drop_teacher_assignments.sql
-- Simplify to single source of truth: profile.enrollments only
-- No more teacher_assignments join table needed

-- Drop the teacher_assignments table and any dependent objects (policies)
DROP TABLE IF EXISTS public.teacher_assignments CASCADE;

-- Note: Courses and Lessons RLS policies already exist and don't need teacher_assignments
-- The filter happens at the application level using profile.enrollments
