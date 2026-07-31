<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Project Context: Performers Ready! Curriculum Management Platform

### Overview
Vercel deployment with Supabase for admin/teacher workflow. Manages music education curriculum with rich text lesson editing.

### Key Technologies
- **Framework**: Next.js with Turbopack
- **Database/Auth**: Supabase (PostgreSQL)
- **Rich Text Editor**: TipTap with custom extensions
- **Styling**: Tailwind CSS with shadcn/ui components
- **Font**: Montserrat

### Important Implementation Notes

#### CSS Styling Conventions
- Use `style="margin-left: Npx"` for indentation (required for PDF generation)
- Clean CSS without `!important` - use specificity hierarchy
- Headers use `h3` for all bold headings (no anchor-standard class)
- All h3s treated equally - no special styling for anchor standards
- `.lesson-content` wrapper needed for CSS selectors: `#vapa_text_block td .lesson-content > h3`
- First h3 in any section gets 0.5rem top margin (first-of-type rule)
- Subsequent h3s get 1.5rem top margin
- **Empty paragraphs**: Use `min-height: 0.5rem` and `display: block` to ensure hard return gaps render correctly

#### Lesson Content Rendering
- Uses `dangerouslySetInnerHTML` instead of ReactMarkdown to preserve empty HTML tags
- Content is sanitized on save, so no XSS risk
- Empty `<p>` tags need CSS fix to render properly: `.lesson-content p:empty { min-height: 0.5rem; display: block; }`

#### TipTap Editor Extensions
Located in `src/components/editor/extensions/`:

**spell-check.ts** - Custom spellcheck with:
- 107K word dictionary loaded from `words-en.json`
- Common words and contractions in `commonWords` Set
- Custom words stored in `customWords` Set (persisted to localStorage)
- Handles possessives/contractions: strips `'s`, `s'`, `'ve`, `'re`, `'ll`, `'m`, `n't` before spell checking
- Handles both straight (`'`) and curly (`'` U+2019, `'`) apostrophes
- Uses ProseMirror decorations to underline misspelled words
- CSS class `.misspelled` for styling (underline wavy red)

**words-en.json** - Bundled word list from wordlist-english package (~107K words)

#### Spellcheck Word Handling
- **Apostrophe patterns**: The spellcheck preserves apostrophes in possessive/contraction patterns before checking
  - Pattern check: `/.*['\u2019]s$/i` for possessives, `/.*['\u2019]ve$/i` for contractions, etc.
  - If word matches pattern, apostrophe is preserved (not stripped) before base word check
- **Base word checking**: After preserving/stripping apostrophes, checks if base word is in dictionary
  - e.g., `today's` → preserves `'s` → checks `today` → found ✓
  - e.g., `we've` → preserves `'ve` → checks `we` → found ✓
- **Custom words**: Added via + button in editor toolbar, persisted to localStorage key `spellcheck-custom-words`
- **+ / - buttons**: Add or remove custom words, only removes words added via +, not base dictionary
- **Cross-node boundary check**: Flags text ending with `:` when followed by text starting with a letter across inline tags (e.g., `<strong>Content:</strong>Students` - flags "Content:" as potentially having missing space after colon)

#### Show Invisibles Feature
- Uses official `@tiptap/extension-invisible-characters` extension
- Toggle via `editor?.commands.toggleInvisibleCharacters()`
- Extension handles its own CSS styling (not custom CSS in globals.css)
- Shows hard returns (paragraph breaks) and soft returns (line breaks)

#### Cleanup HTML Endpoint
`POST /api/cleanup-html` - Consolidated cleanup for:
- Nested tags removal
- Malformed HTML fixing (p>strong with h3 closing, h3 with stray </strong>, h3 containing PK.MU:/PK:/MU:)
- Anchor standard removal (replacing h3.anchor-standard with plain h3)

#### Check for Understanding (CFU) Entity
- TipTap block node with ReactNodeViewRenderer
- 8 attributes: cfuId, backgroundImage, pngImage, heading, content, alignment, width, pngWidth
- 9 position options: wrap-top-left/center/right, left/center/right, wrap-bottom-left/center/right
- Default entity width: 50%, background: contain, padding: 30px 40px
- Text: 16px, weight 700, vertical-align middle, text-align left
- **Left column: 25% fixed width, image right-aligned, pngWidth (1-100, default 100) controls image width within column**
- **Click-to-edit**: Single click opens modal (with z-index, contentEditable=false fixes)
- **Unique cfuId**: Generated on insert (Date.now().toString(36) + random)
- **Editor isolation**: Only the editor containing the CFU opens its modal
- **Modal uses refs**: onCloseRef, onInsertRef for stable callback references
- **Click rate limiting**: 1-second cooldown via lastClickRef in NodeView
- **Delete with confirmation**: Delete button in modal footer (when editing), confirmation modal in editor

#### CFU Attribute Parsing (addAttributes)
CFU attributes are stored as HTML attributes on the div. TipTap writes lowercase attribute names:
- `backgroundimage` - URL for background SVG image (TipTap format)
- `pngimage` - URL for left column image
- `cfuid` / `data-cfu-id` - unique identifier
- `data-background-image` / `data-png-image` - alternative data attribute format
- `heading` / `content` - text content (also read from inner h4/p tags)
- `alignment` / `width` / `pngwidth` - positioning and sizing

**parseHTML fallback chain** (e.g., for `backgroundImage`):
1. Check `backgroundimage` attribute first (TipTap writes this)
2. Check `data-background-image` attribute
3. Parse from `style` attribute's `background-image: url(...)` as last resort

This ensures existing CFUs in database work regardless of which format their attributes are stored in.

#### CFU SQL Migrations
- CFUs stored in 15 text fields: lesson_outline, learning_objectives, vocabulary, materials, vapa_text_block, ncas_text_block, welcome_opening, actual_class_expectations, warm_up, lesson_hook, main_activity, instrument_expectations, reflection, closing_ceremony, assessment
- Each CFU is a div with data-check-for-understanding="true" attribute
- **Padding updates**: Use regex to target only CFU div padding (e.g., `padding:\s*3px\s+60px`), not all padding in database
- **Background updates**: Must use `&quot;` encoding for URL quotes in inline styles (TipTap format)
- **Background image SVG**: Must have `preserveAspectRatio="none"` in SVG markup to stretch correctly with `background-size: 100% 100%`

#### PDF CFU Styling (pdf-service/src/template.js)
- **CFU Block**: padding: 3px 20px, margin: 8px 0 48px 0, overflow: hidden
- **CFU font**: 10pt for both h4 title and p body (matching body font size)
- **Background image**: Uses `preserveAspectRatio="none"` on SVG to allow stretching with `background-size: 100% 100%`
- **Wrapped CFUs** (wrap-top-left, wrap-top-right, etc.): `display: flow-root` for proper float containment
- **Section headers** (`.section-header`): `clear: both` to prevent overlap with floated CFUs from previous section
- **CFU margins with !important**: All CFU alignment classes have `!important` to override inline styles
- **Lesson Outline bullets**: Uses `margin-bottom: -5px` (negative margin) to close up vertical space between bullet items
- **Key CSS patterns**:
  ```css
  .lesson-content [data-check-for-understanding="true"] {
    padding: 3px 20px !important;
    margin: 8px 0 48px 0 !important;
    overflow: hidden;
    background-size: 100% 100% !important;
  }
  .lesson-content [data-check-for-understanding][class*="wrap"] {
    display: flow-root;
  }
  .section-header {
    clear: both;
  }
  .lesson-content .cfu-wrap-top-left {
    margin: 0 20px 16px 0 !important;
  }
  /* etc for all alignment classes */
  .left-column .lesson-content li {
    margin-bottom: -5px;  /* tighter bullet spacing in lesson outline */
  }
  ```

#### Table Extensions
**table-with-styles.ts** - Custom table extension with:
- `columnWidths` attribute (array of percentage strings like ["33%", "33%", "34%"])
- `tableWidth` attribute (overall width percentage)
- `tableAlignment` attribute (left/center/right)
- `showGrid` attribute for lesson grid toggle
- `renderHTML` generates `<colgroup>` with proper inline styles
- Uses `table-layout: fixed` for colgroup widths to work

**table-cell-with-width.ts** - Simplified cell extension (no per-cell width attribute)

**Table column index fix**: Changed from `$from.index(depth)` to node reference comparison (`row.child(i) === cellNode`) to fix always returning 0 bug

#### Image Extension
**image-with-options.ts** - Custom image extension with alignment and width:
- `align` attribute: 'left' | 'center' | 'right'
  - Left: no style (default)
  - Center: `display: block; margin-left: auto; margin-right: auto;`
  - Right: `float: right;`
- `widthPercent` attribute: 1-100 (renders as `width: X%;` style)
- **Commands**: `setImageAlign`, `setImageWidth`, `deleteImage`
- **Image toolbar**: Appears when image is selected, contains align buttons, width input, delete button
- **Delete image**: Uses custom modal confirmation (not browser alert)

#### Spotify Embed Component
**spotify-embed.tsx** - Draggable and resizable Spotify playlist modal:
- Appears in top-right corner when opened
- Draggable by header (uses refs, no re-renders during drag)
- Resizable from bottom-right corner
- X button to close
- Uses direct DOM manipulation during drag to prevent iframe reload

#### Lesson Editor Layout (Admin)
Two-column layout at `src/app/(dashboard)/admin/courses/[id]/lessons/[lessonId]/page.tsx`:

**Left Column (280px, sticky):**
- "General Info" button (coral when inactive, green when active)
- "Lesson Materials" button (coral when inactive, green when active)
- Divider
- 15 section buttons (green when selected, light teal when not)

**Right Column (flex-1):**
- **General Info panel**: Lesson Number, Title, Total Time inputs
- **Lesson Materials panel**: Assets panel, Presentation (Spotify is now on course level)
- **Section Editor panel**: Section label + TipTap LessonEditor with sticky toolbar

**State Management:**
- `activePanel: 'general' | 'materials' | 'section'`
- `selectedSection` tracks which content section (for section panel)
- **URL param**: `?section=<fieldName>` opens directly to that section on page load

**Editor Toolbar (sticky at top-14 z-40):**
- Contains all formatting buttons (Bold, Italic, H2, H3, Lists, etc.)
- Table context toolbar when inside table
- Image context toolbar when image is selected
- All toolbars in single sticky container

### Database Schema
- `profiles` - User profiles with role (admin/teacher)
- `courses` - Course information with discipline, grade, and spotify_embed_code
- `lessons` - Individual lessons with content, timing, presentation, etc. (Spotify is now on courses table)
- `teacher_assignments` - Links teachers to courses
- `lesson_assets` - Links assets to lessons with sort_order
- `cfu_assets` - Check for Understanding assets (admin only)

### RLS Policies
- Profiles: Users can read all, update only own profile
- Courses/Lessons: Admin full access, teachers can read assigned courses
- Teacher assignments tracked via `teacher_assignments` table

### Common Tasks

#### Adding new TipTap extension
1. Create file in `src/components/editor/extensions/`
2. Import and add to extensions array in `lesson-editor.tsx`
3. Follow TipTap Extension API pattern with `addProseMirrorPlugins()` for decorations

#### Spellcheck troubleshooting
- If words still flagged, check:
  1. Is the apostrophe type correct (straight vs curly)?
  2. Is the pattern in the possessive/contraction regex?
  3. Is the base word in dictionary?
- To add words temporarily: Use + button in editor
- To add words permanently: Add to `commonWords` in spell-check.ts

#### Find & Replace Feature
- **Location**: Collapsible panel at top of lesson editor and student lesson view (admin only)
- **Scope options**: Lesson, Course (with course dropdown), or Global
- **Find field**: Checkbox below "Match case exactly" - ON = case sensitive, OFF = case insensitive (default: OFF)
- **Replace field**: Checkbox "Force exact case" - ON = exact replacement, OFF = preserve original case pattern (default: ON)
- **Search behavior**: Case-sensitive or case-insensitive substring match on text content (ignores HTML tags). Can find text that spans across inline tag boundaries (e.g., `<strong>Content:</strong>Students` - can find "Content:Students")
- **Replace behavior**: Exact case from replacement input (when Force exact case = ON), or preserves original case pattern (when OFF). Both find and replace now handle cross-segment matches.
- **Results**: Shows Lesson Number, Course Name, Grade, Field Label, and match snippet. Grade helps distinguish duplicate course names across different grades.
- **View button**: Opens lesson editor directly to the matching section via `?section=<fieldName>` URL param
- **Key files**:
  - `src/lib/html-utils.ts` - HTML parsing, text finding/replacing helpers (includes `replaceTextPreserveCase` for case-preserving replace)
  - `src/app/api/find-replace/route.ts` - GET (search) and PATCH (replace) API endpoints
  - `src/components/find-replace-panel.tsx` - UI component with scope selector, case options, results display
- **API endpoints**:
  - GET `/api/find-replace?search=X&scope=lesson|course|global&lessonId=X&courseId=X&caseSensitive=true|false`
  - PATCH `/api/find-replace` - Body: `{ search, replace, scope, lessonId?, courseId?, caseSensitive, forceExactCase }`

#### Internal Section Links
- **Purpose**: Link text within one lesson section to another section of the same lesson (e.g., "Lesson Hook" text linking to the "Lesson Hook" section)
- **Implementation**: Uses anchor links with `#section_key` format (e.g., `#lesson_hook`)
- **Link Modal**: Added "Sections" tab showing all 15 lesson sections
- **Insert behavior**: Clicking a section inserts link with `href="#section_key"` and `class="section-link"`
- **Visual styling**: Section links styled in teal (`#0d7377`) to distinguish from external links (red) and resource links
- **Student view**: Each section renders with `id={section.key}`, so clicking section links scrolls to that section

#### Page Break Images
- `last-page.png` - Full-width flush image before Assessment section (Assessment is the last content page)
- Stored in `/public/images/` in Next.js repo, served at `{APP_URL}/images/`
- CSS class `.page-break-image` with `object-fit: contain`, `break-before: page`
- page3.png no longer used (VAPA/NCAS sections no longer have page break images)

#### PDF Generation
- **Architecture**: Dedicated Puppeteer service on Render.com, separate from Vercel (Vercel's 250MB serverless limit can't accommodate Puppeteer's ~170MB Chromium)
- **GitHub repo**: `https://github.com/takingaction/pdf-service`
- **Render service**: `https://pdf-service-m3mc.onrender.com` (Free tier - may have cold start latency)
- **API endpoints**:
  - `POST /pdf` - Accepts `{ html: string, filename?: string }` → returns `application/pdf`
  - `POST /lesson-pdf` - Accepts `{ lesson: object, course: object, filename?: string }` → returns `application/pdf`
  - `POST /debug-html` - Returns rendered HTML for testing
  - `GET /health` - Health check
- **Lesson PDF sections** (in order):
  1. Lesson Outline
  2. Learning Objectives
  3. Vocabulary
  4. Materials
  5. VAPA Standards
  6. NCAS Standards
  7. Welcome and Opening Check-In
  8. Class Expectations and Procedures
  9. Warm Up
  10. Lesson "Hook"
  11. Main Activity
  12. Instrument Expectations
  13. Reflection
  14. Closing Ceremony
  15. Assessment
- **PDF Layout**:
  - **Page 1 (Title Page)**: "PERFORMERS READY!" logo, course name and grade on coral background, hero image fills remainder. `@page :first { margin: 0; }`
  - **Page 2 (Two-Column)**: "LESSON PLAN: CLASS N" header + `"Lesson Title"` in curly quotes. Left column = Lesson Outline (70/30 split); Right column = Learning Objectives, Vocabulary, Materials. Uses default `@page { margin: 0.5in; }`
  - **Pages 3+ (Full-Width)**: All remaining sections in full-width stacked layout with 0.5in margins
  - **Assessment Page (Last)**: Full bleed page (`@page assessment { margin: 0; }`) with fake 0.5in side margins via `padding: 0 0.5in` on `.assessment-section`. Contains last-page.png (flush), assessment table, logo-end.jpg (35% width centered)
  - **Section Headers**: VAPA/NCAS = gray (#D1D3DB); All others = coral (#e37c64)
- **PDF features**:
  - Uses `courses.pdf_image_url` for title page hero image (separate from website `image_url`)
  - Letter size with 0.5in margins on pages 2+
  - Assessment page uses named `@page assessment { margin: 0; }` with fake side margins via padding
  - Sections only included if content exists (not null/empty)
  - CSS support for tables, images (alignment), lists, bold/italic
  - CFU blocks: no gray background, no vertical line, alignment classes match lesson view, 20px margins with `!important` for text wrap
  - Puppeteer footer template for page numbers (abandoned due to @sparticuz/chromium limitations)
- **Key files in pdf-service**:
  - `src/index.js` - Express server with Puppeteer PDF generation
  - `src/template.js` - HTML template builder for lesson PDFs
  - `render.yaml` - Render deployment configuration
- **PDF API endpoints** (Next.js):
  - `GET /api/lessons/[lessonId]/pdf/info` - Get PDF metadata (exists, generated_at, file_size, filename)
  - `GET /api/lessons/[lessonId]/pdf` - View or download PDF (via ?download=true/false)
  - `POST /api/lessons/[lessonId]/pdf/generate` - Generate PDF, upload to Supabase Storage, update metadata
  - `GET /api/lessons/[lessonId]/pdf/diagnostics` - Diagnostic endpoint for debugging PDF issues
- **PDF error handling**: Generate endpoint returns detailed diagnostics on failure including PDF service URL, response status, HTML vs JSON detection, and extracted error messages

#### Batch PDF Regeneration Tool
Admin tool for regenerating all lesson PDFs at `/admin/pdf-regenerate`.

**Database tables**:
- `batch_pdf_jobs` - Tracks batch job status (pending/processing/completed/cancelled), progress counts, created_by
- `batch_pdf_results` - Individual lesson results with status (pending/success/failed), error messages, retry_count

**API endpoints**:
- `POST /api/batch/pdf-regenerate` - Start new batch (clears old stuck/cancelled jobs first, creates result records for all lessons)
- `GET /api/batch/current` - Get current running job or most recent
- `GET /api/batch/[jobId]?page=N&pageSize=20&status=success|failed` - Paginated results with course/lesson info
- `POST /api/batch/[jobId]/results` - Submit result for a lesson (handles 1 retry on failure)
- `POST /api/batch/[jobId]/cancel` - Cancel a running batch job
- `POST /api/batch/clear-stuck` - Clear stuck processing jobs

**Processing flow**:
1. Admin clicks "Start New Batch" → confirmation modal → starts batch
2. API clears any stuck/cancelled/processing jobs before starting
3. Client fetches all lesson IDs and processes sequentially (1 at a time)
4. Each lesson: POST to `/api/lessons/[id]/pdf/generate` → retry once if failed → submit result
5. Progress updates via polling every 2 seconds

**UI features**:
- **Cancel button**: In notification banner while batch is running, stops processing loop and updates database
- Progress bar + counters (success/fail/total)
- Filter tabs (All/Success/Failed)
- Paginated results table with Discipline, Grade, Lesson #, Title, Status
- Row actions: [Log] [Edit Lesson] [View PDF]
- Log modal shows full PDF diagnostics for failed lessons
- Confirmation modal before starting batch
- Stuck job detection with "Clear Stuck Job" button

**Note**: On Render Starter plan, PDFs process sequentially (~20 sec each, ~4 hours for 720 lessons)

### Environment Variables Required
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `PDF_SERVICE_URL` - URL for PDF generation service (e.g., `https://pdf-service-m3mc.onrender.com`)

### Relevant Files
- `src/app/(dashboard)/admin/courses/[id]/page.tsx` - Course edit page with Spotify section
- `src/components/course-spotify-section.tsx` - Course-level Spotify modal and controls (includes SpotifyEmbed preview)
- `src/app/(dashboard)/admin/courses/[id]/lessons/[lessonId]/page.tsx` - Main lesson edit page with two-column layout and PDF tab
- `src/components/editor/lesson-editor.tsx` - TipTap editor with sticky toolbar
- `src/components/editor/extensions/spell-check.ts` - Spellcheck extension
- `src/components/editor/extensions/check-for-understanding.tsx` - CFU entity
- `src/components/editor/extensions/table-with-styles.ts` - Custom table with column widths
- `src/components/editor/extensions/image-with-options.ts` - Custom image with align/width
- `src/components/lesson-assets-panel.tsx` - Lesson assets management
- `src/components/spotify-embed.tsx` - Draggable Spotify playlist modal (lesson view)
- `src/app/(dashboard)/lessons/[lessonId]/page.tsx` - Student/teacher view with SpotifyEmbed from course
- `src/components/check-for-underunderstanding-modal.tsx` - CFU edit modal
- `src/lib/html-utils.ts` - HTML parsing, text finding/replacing for Find & Replace
- `src/app/api/find-replace/route.ts` - Find & Replace API endpoints (GET search, PATCH replace)
- `src/app/api/lessons/[lessonId]/pdf/info/route.ts` - GET PDF metadata (exists, generated_at, file_size)
- `src/app/api/lessons/[lessonId]/pdf/route.ts` - GET PDF (view or download)
- `src/app/api/lessons/[lessonId]/pdf/generate/route.ts` - POST to generate PDF
- `src/app/api/lessons/[lessonId]/pdf/diagnostics/route.ts` - GET diagnostics for debugging
- `src/app/api/batch/pdf-regenerate/route.ts` - Start batch PDF regeneration (clears stuck jobs first)
- `src/app/api/batch/current/route.ts` - Get current/last batch job status
- `src/app/api/batch/[jobId]/route.ts` - Get paginated results for a batch job
- `src/app/api/batch/[jobId]/results/route.ts` - Submit result for a lesson in batch
- `src/app/api/batch/[jobId]/cancel/route.ts` - Cancel a running batch job
- `src/app/api/batch/clear-stuck/route.ts` - Clear stuck processing jobs
- `src/app/(dashboard)/admin/pdf-regenerate/page.tsx` - Admin batch PDF regeneration UI
- `pdf-service/` - External Puppeteer PDF generation microservice (see PDF Generation section)
- `src/components/find-replace-panel.tsx` - Find & Replace UI panel

#### Public Homepage
Landing page at `/` with the following sections:
- `src/app/page.tsx` - Main page assembling all homepage sections
- `src/components/home/Header.tsx` - Fixed header with logo, About Us link, Sign In button
- `src/components/home/HeroSection.tsx` - Full-screen hero with background image and overlay
- `src/components/home/ElementaryArtsSection.tsx` - Text left, image right, peach background
- `src/components/home/GradeLevelSection.tsx` - Two-column layout: title/text left, grade descriptions right
- `src/components/home/VideoSection.tsx` - Click-to-open video popup with native dialog element
- `src/components/home/UnlockSection.tsx` - Image left, text right with pricing info
- `src/components/home/CallToActionSection.tsx` - Contact info and Calendly CTA button
- `src/components/home/Footer.tsx` - Copyright with dynamic year
- `public/images/` - Local copies of homepage images (logo.png, hero-bg.jpg, kids-dancing.png, video-thumbnail.jpg, opportunities-image.png)
