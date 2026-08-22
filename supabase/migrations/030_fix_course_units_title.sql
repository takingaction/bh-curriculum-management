-- Fix course_units title constraint to allow any non-null title

ALTER TABLE public.course_units DROP CONSTRAINT IF EXISTS course_units_title_check;
ALTER TABLE public.course_units ADD CONSTRAINT course_units_title_check CHECK (title IS NOT NULL);
