# Performers Ready! Curriculum Management Platform

A Next.js-based curriculum management system for music education, built with Supabase for database and storage.

## Features

### Curriculum Management
- **Courses**: Create and manage courses with discipline and grade levels
- **Lessons**: Rich text lesson plans with 15 content sections (Lesson Outline, Learning Objectives, Vocabulary, Materials, VAPA Standards, NCAS Standards, Welcome and Opening Check-In, Lesson Hook, Class Expectations and Procedures, Warm Up, Main Activity, Instrument Expectations, Assessment, Reflection, Closing Ceremony)
- **Rich Text Editor**: TipTap-based editor with custom spellcheck, formatting toolbar, table support, and hyperlink insertion
- **Hyperlinks**: Insert links with URL and "Open in New Window" option; links styled in teal with underline

### Curriculum Resources
- **Asset Library**: Upload and manage PDF, video (MP4, MOV), and audio (MP3, M4A) files
- **Categories**: 7 pre-configured categories (Drumming Materials, General Dance, General Music, General Theatre, Recorder Materials, Ukulele Materials, Voice Materials)
- **Large File Support**: Direct client-side uploads to Supabase Storage (bypasses serverless 4.5MB limit)
- **Multi-file Upload**: Upload multiple files at once with summary display
- **Lesson Attachments**: Attach resources to lessons for student access
- **Reordering**: Drag-and-drop to reorder attached resources (admin only)
- **Rename Resources**: Click edit icon in preview panel to rename assets
- **Attached Status**: Assets already added to lesson show checkmark badge and "Already Added" state
- **Duplicate Prevention**: Cannot add same resource twice; friendly message shown
- **Presentation Links**: Add presentation name + URL (opens in new tab)
- **Spotify Playlists**: Add Spotify embed code; displays in slideout panel

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
- **View As**: Toggle between admin and teacher views in header

### Student Lesson View
- Course title and grade displayed above lesson name
- Duration shown below lesson title
- Resources displayed below lesson content
- Links styled in teal (#0d7377) with underline
- White text on coral (#e37c64) header backgrounds

## Tech Stack

- **Framework**: Next.js 16 with Turbopack
- **Database/Auth**: Supabase (PostgreSQL)
- **Rich Text Editor**: TipTap
- **Styling**: Tailwind CSS with shadcn/ui components
- **Storage**: Supabase Storage (direct client-side uploads)
- **Drag & Drop**: @dnd-kit/core and @dnd-kit/sortable
- **Font**: Montserrat

## Getting Started

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Database Setup

Run migrations in `supabase/migrations/` to set up:
- Schema (tables, RLS policies)
- Asset storage tables and bucket
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
- `PUT /api/assets/[id]` - Update asset (rename)
- `DELETE /api/assets/[id]` - Delete asset
- `POST /api/assets/fix-urls` - Fix legacy asset URLs (missing bucket name)

### Lesson Assets
- `GET /api/lessons/[id]/assets` - Get lesson's assets (ordered by sort_order)
- `POST /api/lessons/[id]/assets` - Attach asset to lesson
- `PATCH /api/lessons/[id]/assets/reorder` - Reorder assets (body: `{ orderedAssetIds: string[] }`)
- `DELETE /api/lessons/[id]/assets/[assetId]` - Detach asset

## Editor Features

### Toolbar Buttons
- **Text**: Bold, Italic, Strikethrough, Link (chain icon)
- **Headings**: H2, H3
- **Lists**: Bullet, Ordered, Increase List Level (→), Decrease List Level (←)
- **Table**: Insert table, Toggle grid
- **View**: Show invisibles, Undo/Redo
- **Media**: Media library, Upload image
- **Indent**: Decrease, Increase
- **Source**: Toggle source code view

### Link Insertion
Click link button (chain icon) to insert hyperlink:
- URL field (required)
- Open in New Window checkbox
- Links styled teal (#0d7377) with underline

## Deploy on Vercel

The app is designed for Vercel deployment with Supabase integration.