# Performers Ready! Curriculum Management Platform

A Next.js-based curriculum management system for music education, built with Supabase for database and storage.

## Features

### Curriculum Management
- **Courses**: Create and manage courses with discipline and grade levels
- **Lessons**: Rich text lesson plans with 16 content sections (Overview, Lesson Outline, Learning Objectives, Vocabulary, Materials, VAPA Standards, NCAS Standards, Welcome and Opening Check-In, Lesson Hook, Class Expectations and Procedures, Warm Up, Main Activity, Instrument Expectations, Assessment, Reflection, Closing Ceremony)
- **Rich Text Editor**: TipTap-based editor with custom spellcheck, formatting toolbar, and table support

### Curriculum Resources
- **Asset Library**: Upload and manage PDF, video (MP4, MOV), and audio (MP3, M4A) files
- **Categories**: 7 pre-configured categories (Drumming Materials, General Dance, General Music, General Theatre, Recorder Materials, Ukulele Materials, Voice Materials)
- **Large File Support**: Direct client-side uploads to Supabase Storage (bypasses serverless 4.5MB limit)
- **Lesson Attachments**: Attach resources to lessons for student access

### Spellcheck System
- Custom spellcheck extension with 107K word dictionary
- Contraction handling (can't, don't, won't, etc.)
- Possessive handling (musician's, teacher's, etc.)
- Custom word additions via localStorage
- Flags missing spaces (e.g., `Content:Students` → detected as error)

### Admin & Teacher Workflows
- **Admin Dashboard**: Full course and lesson management
- **Teacher Dashboard**: View assigned courses and lessons
- **Role-based Access**: Admin and teacher roles with Supabase auth

## Tech Stack

- **Framework**: Next.js 16 with Turbopack
- **Database/Auth**: Supabase (PostgreSQL)
- **Rich Text Editor**: TipTap
- **Styling**: Tailwind CSS with shadcn/ui components
- **Storage**: Supabase Storage (direct client-side uploads)
- **Font**: Montserrat

## Getting Started

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Database Setup

Run migrations in `supabase/migrations/` to set up:
- Schema (tables, RLS policies)
- Asset storage tables
- Course images table

## Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

## API Routes

### Asset Management
- `GET /api/asset-categories` - List categories
- `POST /api/asset-categories` - Create category
- `PUT /api/asset-categories/[id]` - Update category
- `DELETE /api/asset-categories/[id]` - Delete category
- `GET /api/assets` - List assets (with filters)
- `POST /api/assets/upload-url` - Get signed upload URL
- `POST /api/assets/confirm` - Confirm upload
- `DELETE /api/assets/[id]` - Delete asset

### Lesson Assets
- `GET /api/lessons/[id]/assets` - Get lesson's assets
- `POST /api/lessons/[id]/assets` - Attach asset to lesson
- `DELETE /api/lessons/[id]/assets/[assetId]` - Detach asset

## Deploy on Vercel

The app is designed for Vercel deployment with Supabase integration.