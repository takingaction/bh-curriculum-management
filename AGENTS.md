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

### Database Schema
- `profiles` - User profiles with role (admin/teacher)
- `courses` - Course information with discipline and grade
- `lessons` - Individual lessons with content, timing, etc.
- `teacher_assignments` - Links teachers to courses

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

### Environment Variables Required
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
