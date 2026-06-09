


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."fix_table_html"("content" "text") RETURNS "text"
    LANGUAGE "plpgsql"
    AS $_$
DECLARE
  result TEXT;
BEGIN
  -- Remove colgroup tags entirely
  result := regexp_replace(content, '<colgroup>.*?</colgroup>', '', 'gi');
  
  -- Fix tables: replace min-width with width, add proper margin for centering
  -- Pattern: <table style="min-width: XXXpx"> -> <table style="width: 75%; margin-left: auto; margin-right: auto;">
  result := regexp_replace(result, '<table([^>]*)style="min-width:\s*(\d+)px"', '<table$1style="width: 75%; margin-left: auto; margin-right: auto;"', 'gi');
  
  -- If table has no style at all but has colgroup removed, add default width/center
  result := regexp_replace(result, '<table([^>]*)>', '<table$1style="width: 75%; margin-left: auto; margin-right: auto;">', 'gi');
  
  -- Clean up any double semicolons or spacing issues
  result := regexp_replace(result, ';{2,}', ';', 'g');
  result := regexp_replace(result, ';\s*>', ';>', 'g');
  
  RETURN result;
END;
$_$;


ALTER FUNCTION "public"."fix_table_html"("content" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role)
  VALUES (new.id, new.email, 'admin');
  RETURN new;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."adapted_lessons" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "original_lesson_id" "uuid" NOT NULL,
    "teacher_id" "uuid" NOT NULL,
    "title" "text",
    "lesson_outline" "text",
    "learning_objectives" "text",
    "vocabulary" "text",
    "materials" "text",
    "vapa_text_block" "text",
    "ncas_text_block" "text",
    "welcome_opening" "text",
    "actual_class_expectations" "text",
    "lesson_hook" "text",
    "warm_up" "text",
    "main_activity" "text",
    "instrument_expectations" "text",
    "reflection" "text",
    "closing_ceremony" "text",
    "assessment" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."adapted_lessons" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_usage_counters" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "window_start" timestamp with time zone NOT NULL,
    "request_count" integer DEFAULT 0
);


ALTER TABLE "public"."ai_usage_counters" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."asset_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "sort_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."asset_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."assets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "category_id" "uuid",
    "filename" "text" NOT NULL,
    "display_name" "text" NOT NULL,
    "storage_path" "text" NOT NULL,
    "public_url" "text" NOT NULL,
    "file_type" "text" NOT NULL,
    "file_size" bigint DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."assets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."course_images" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "course_id" "uuid" NOT NULL,
    "filename" "text" NOT NULL,
    "storage_path" "text" NOT NULL,
    "public_url" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."course_images" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."courses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "discipline" "text" NOT NULL,
    "grade" "text" NOT NULL,
    "total_lessons" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "image_url" "text"
);


ALTER TABLE "public"."courses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lesson_assets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "lesson_id" "uuid" NOT NULL,
    "asset_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "sort_order" integer DEFAULT 0
);


ALTER TABLE "public"."lesson_assets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lessons" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "course_id" "uuid" NOT NULL,
    "lesson_number" integer NOT NULL,
    "title" "text" NOT NULL,
    "total_time" "text",
    "lesson_outline" "text",
    "learning_objectives" "text",
    "vocabulary" "text",
    "materials" "text",
    "vapa_text_block" "text",
    "ncas_text_block" "text",
    "welcome_opening" "text",
    "actual_class_expectations" "text",
    "lesson_hook" "text",
    "warm_up" "text",
    "main_activity" "text",
    "instrument_expectations" "text",
    "reflection" "text",
    "closing_ceremony" "text",
    "assessment" "text",
    "lesson_images" "jsonb" DEFAULT '[]'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "presentation_name" "text",
    "presentation_url" "text",
    "spotify_embed_code" "text"
);


ALTER TABLE "public"."lessons" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "full_name" "text",
    "role" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "profiles_role_check" CHECK (("role" = ANY (ARRAY['admin'::"text", 'teacher'::"text"])))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."teacher_assignments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "teacher_id" "uuid" NOT NULL,
    "course_id" "uuid" NOT NULL,
    "assigned_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."teacher_assignments" OWNER TO "postgres";


ALTER TABLE ONLY "public"."adapted_lessons"
    ADD CONSTRAINT "adapted_lessons_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_usage_counters"
    ADD CONSTRAINT "ai_usage_counters_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_usage_counters"
    ADD CONSTRAINT "ai_usage_counters_user_id_window_start_key" UNIQUE ("user_id", "window_start");



ALTER TABLE ONLY "public"."asset_categories"
    ADD CONSTRAINT "asset_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."assets"
    ADD CONSTRAINT "assets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."course_images"
    ADD CONSTRAINT "course_images_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."courses"
    ADD CONSTRAINT "courses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lesson_assets"
    ADD CONSTRAINT "lesson_assets_lesson_id_asset_id_key" UNIQUE ("lesson_id", "asset_id");



ALTER TABLE ONLY "public"."lesson_assets"
    ADD CONSTRAINT "lesson_assets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lessons"
    ADD CONSTRAINT "lessons_course_id_lesson_number_key" UNIQUE ("course_id", "lesson_number");



ALTER TABLE ONLY "public"."lessons"
    ADD CONSTRAINT "lessons_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."teacher_assignments"
    ADD CONSTRAINT "teacher_assignments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."teacher_assignments"
    ADD CONSTRAINT "teacher_assignments_teacher_id_course_id_key" UNIQUE ("teacher_id", "course_id");



CREATE INDEX "idx_lesson_assets_sort_order" ON "public"."lesson_assets" USING "btree" ("lesson_id", "sort_order");



ALTER TABLE ONLY "public"."adapted_lessons"
    ADD CONSTRAINT "adapted_lessons_original_lesson_id_fkey" FOREIGN KEY ("original_lesson_id") REFERENCES "public"."lessons"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."adapted_lessons"
    ADD CONSTRAINT "adapted_lessons_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_usage_counters"
    ADD CONSTRAINT "ai_usage_counters_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."assets"
    ADD CONSTRAINT "assets_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."asset_categories"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."course_images"
    ADD CONSTRAINT "course_images_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lesson_assets"
    ADD CONSTRAINT "lesson_assets_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lesson_assets"
    ADD CONSTRAINT "lesson_assets_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lessons"
    ADD CONSTRAINT "lessons_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."teacher_assignments"
    ADD CONSTRAINT "teacher_assignments_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."teacher_assignments"
    ADD CONSTRAINT "teacher_assignments_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



CREATE POLICY "Admins full access courses" ON "public"."courses" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));



CREATE POLICY "Admins full access lessons" ON "public"."lessons" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));



CREATE POLICY "Admins manage asset_categories" ON "public"."asset_categories" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));



CREATE POLICY "Admins manage assets" ON "public"."assets" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));



CREATE POLICY "Admins manage assignments" ON "public"."teacher_assignments" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));



CREATE POLICY "Admins manage course_images" ON "public"."course_images" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));



CREATE POLICY "Admins manage lesson_assets" ON "public"."lesson_assets" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));



CREATE POLICY "Admins read adapted lessons" ON "public"."adapted_lessons" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));



CREATE POLICY "Teachers manage own adapted lessons" ON "public"."adapted_lessons" USING (("teacher_id" = "auth"."uid"()));



CREATE POLICY "Teachers read assigned courses" ON "public"."courses" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."teacher_assignments"
  WHERE (("teacher_assignments"."teacher_id" = "auth"."uid"()) AND ("teacher_assignments"."course_id" = "courses"."id")))));



CREATE POLICY "Teachers read lessons in assigned courses" ON "public"."lessons" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."teacher_assignments"
  WHERE (("teacher_assignments"."teacher_id" = "auth"."uid"()) AND ("teacher_assignments"."course_id" = "lessons"."course_id")))));



CREATE POLICY "Teachers view own assignments" ON "public"."teacher_assignments" FOR SELECT USING (("teacher_id" = "auth"."uid"()));



CREATE POLICY "Users can insert own profile" ON "public"."profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can update own profile" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can view own profile" ON "public"."profiles" FOR SELECT USING (("auth"."uid"() = "id"));



CREATE POLICY "Users manage own counters" ON "public"."ai_usage_counters" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users read course_images" ON "public"."course_images" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



ALTER TABLE "public"."adapted_lessons" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ai_usage_counters" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."asset_categories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."assets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."course_images" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."courses" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."lesson_assets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."lessons" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."teacher_assignments" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






















































































































































GRANT ALL ON FUNCTION "public"."fix_table_html"("content" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."fix_table_html"("content" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fix_table_html"("content" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";


















GRANT ALL ON TABLE "public"."adapted_lessons" TO "anon";
GRANT ALL ON TABLE "public"."adapted_lessons" TO "authenticated";
GRANT ALL ON TABLE "public"."adapted_lessons" TO "service_role";



GRANT ALL ON TABLE "public"."ai_usage_counters" TO "anon";
GRANT ALL ON TABLE "public"."ai_usage_counters" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_usage_counters" TO "service_role";



GRANT ALL ON TABLE "public"."asset_categories" TO "anon";
GRANT ALL ON TABLE "public"."asset_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."asset_categories" TO "service_role";



GRANT ALL ON TABLE "public"."assets" TO "anon";
GRANT ALL ON TABLE "public"."assets" TO "authenticated";
GRANT ALL ON TABLE "public"."assets" TO "service_role";



GRANT ALL ON TABLE "public"."course_images" TO "anon";
GRANT ALL ON TABLE "public"."course_images" TO "authenticated";
GRANT ALL ON TABLE "public"."course_images" TO "service_role";



GRANT ALL ON TABLE "public"."courses" TO "anon";
GRANT ALL ON TABLE "public"."courses" TO "authenticated";
GRANT ALL ON TABLE "public"."courses" TO "service_role";



GRANT ALL ON TABLE "public"."lesson_assets" TO "anon";
GRANT ALL ON TABLE "public"."lesson_assets" TO "authenticated";
GRANT ALL ON TABLE "public"."lesson_assets" TO "service_role";



GRANT ALL ON TABLE "public"."lessons" TO "anon";
GRANT ALL ON TABLE "public"."lessons" TO "authenticated";
GRANT ALL ON TABLE "public"."lessons" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."teacher_assignments" TO "anon";
GRANT ALL ON TABLE "public"."teacher_assignments" TO "authenticated";
GRANT ALL ON TABLE "public"."teacher_assignments" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































