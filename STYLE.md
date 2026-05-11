# Style Guidelines - Performers Ready! Curriculum Platform

This document outlines the design system and styling conventions for the Performers Ready! Curriculum Management Platform.

## Brand Overview

Performers Ready! is an arts education curriculum platform with a clean, professional, and welcoming aesthetic. The design prioritizes clarity, warmth, and accessibility.

---

## Color Palette

### Primary Colors

| Name | Hex | Usage |
|------|-----|-------|
| Teal (Primary) | `#0d7377` | Primary actions, links, headings, brand elements |
| Teal Dark | `#0a5c5f` | Hover states for primary elements |
| Teal Light | `#14b8a6` | Charts, secondary teal accents |

### Accent Colors

| Name | Hex | Usage |
|------|-----|-------|
| Coral | `#e85d5d` | Destructive actions, alerts, emphasis |
| Amber | `#f59e0b` | Warnings, highlights |
| Purple | `#8b5cf6` | Special features, AI-related elements |

### Neutral Colors

| Name | Hex | Usage |
|------|-----|-------|
| Charcoal | `#2d2d2d` | Primary text, headings |
| Warm Gray Light | `#f5f5f0` | Backgrounds, cards, subtle fills |
| Gray | `#666666` | Secondary text, descriptions |
| Border Gray | `#e5e5e0` | Borders, dividers |
| Dark Mode BG | `#1a1a1a` | Dark mode background |
| Dark Mode Card | `#242424` | Dark mode cards |

### Semantic Colors

| Name | Hex | Usage |
|------|-----|-------|
| Background | `#ffffff` | Page backgrounds |
| Card | `#ffffff` | Card backgrounds |
| Muted | `#f5f5f0` | Muted backgrounds |
| Muted Foreground | `#666666` | Muted text |
| Destructive | `#dc2626` | Error states |

---

## Typography

### Font Family

**Montserrat** (via next/font/google)

- Primary sans-serif font
- Clean, modern, highly readable
- Weights: 400, 500, 600, 700
- Fallback: `-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`

### Type Scale

| Element | Size | Weight |
|---------|------|--------|
| Body | 18px | Regular (400) |
| Headers (H1-H6) | 20px | Semibold (600) |
| H1 | 24px (text-2xl) | Bold (700) |
| H2 | 20px | Bold (700) |
| H3 | 16px | Semibold (600) |
| Small | 14px | Regular (400) |
| Caption | 12px | Regular (400) |

### Text Colors

- **Primary text**: `#2d2d2d`
- **Secondary text**: `#666666`
- **Link text**: `#0d7377` (use `hover:text-[#0a5c5f]`)
- **Destructive text**: `#e85d5d`

---

## Spacing & Layout

### Container

- Max width: `max-w-7xl` (1280px)
- Padding: `px-4 sm:px-6 lg:px-8`
- Section spacing: `py-8` or `mb-8`

### Border Radius

| Name | Value |
|------|-------|
| Small | `0.375rem` (6px) |
| Default | `0.75rem` (12px) |
| Large | `1rem` (16px) |
| Full (pills) | `9999px` |

### Shadows

- Card shadow: `shadow-sm`
- Modal/dropdown: `shadow-lg`

---

## Components

### Header/Navigation

```tsx
<header className="bg-white border-b border-[#e5e5e0]">
  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div className="flex justify-between items-center h-20">
      {/* Logo with inline styles for precise sizing */}
      <div style={{ height: '72px', paddingTop: '6px', paddingBottom: '6px' }}>
        <img src="/images/performers-ready.png" alt="Performers Ready!" style={{ height: '72px', width: 'auto' }} />
      </div>
    </div>
  </div>
</header>
```

### Buttons

**Primary Button**
```tsx
className="bg-[#0d7377] hover:bg-[#0a5c5f] text-white font-medium py-2.5 rounded-lg transition-colors"
```

**Secondary Button**
```tsx
className="bg-[#f5f5f0] hover:bg-[#e5e5e0] text-[#2d2d2d] font-medium py-2.5 rounded-lg transition-colors"
```

**Destructive Button**
```tsx
className="bg-[#e85d5d] hover:bg-[#dc2626] text-white font-medium py-2.5 rounded-lg transition-colors"
```

**Outline Button**
```tsx
className="border-2 border-[#0d7377] text-[#0d7377] hover:bg-[#0d7377] hover:text-white font-medium py-2 rounded-lg transition-colors"
```

### Cards

```tsx
className="bg-white border border-[#e5e5e0] rounded-xl shadow-sm"
```

**Card Header** - Use simple CardHeader without bg or border classes:
```tsx
<CardHeader>
  <CardTitle>Title</CardTitle>
  <CardDescription>Description</CardDescription>
</CardHeader>
<CardContent>
  {/* Content */}
</CardContent>
```

### Form Inputs

```tsx
className="border border-[#e5e5e0] rounded-lg px-3 py-2 focus:border-[#0d7377] focus:ring-1 focus:ring-[#0d7377] outline-none transition-colors"
```

### Badges/Pills

```tsx
className="text-xs px-3 py-1 bg-[#f5f5f0] text-[#666666] rounded-full"
```

---

## Dark Mode

Dark mode is supported with a separate color scheme:

- Background: `#1a1a1a`
- Card: `#242424`
- Border: `#333333`
- Primary text: `#f5f5f0`
- Secondary text: `#999999`

Toggle dark mode using the `dark:` variant.

---

## Common Patterns

### Page Layout

```tsx
<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
  {/* Page content */}
</div>
```

### Stat Card

```tsx
<Card className="border-[#e5e5e0] shadow-sm">
  <CardHeader>
    <CardTitle className="text-4xl font-bold text-[#0d7377]">42</CardTitle>
    <CardDescription className="text-[#666666]">Description</CardDescription>
  </CardHeader>
</Card>
```

### Course Card

```tsx
<div className="p-5 border border-[#e5e5e0] rounded-xl hover:bg-[#f5f5f0] hover:border-[#0d7377] transition-all cursor-pointer">
  <h3 className="font-semibold text-[#2d2d2d]">Course Title</h3>
  <p className="text-sm text-[#666666]">Grade 3 · Music</p>
  <p className="text-sm text-[#0d7377] font-medium mt-2">30 lessons →</p>
</div>
```

### User Menu Dropdown

```tsx
{isAdmin && viewAs === "admin" && (
  <Link
    href="/api/toggle-view?view=teacher"
    className="block px-4 py-2 text-sm text-[#2d2d2d] hover:bg-[#f5f5f0]"
  >
    View as Teacher
  </Link>
)}
```

---

## Iconography

- Use Lucide React icons (included in shadcn/ui)
- Icon size: `size-5` (20px) default
- Icon color inherits from text color

---

## Accessibility

- Always maintain proper color contrast (WCAG AA minimum)
- Use semantic HTML elements
- Include `aria-label` for icon-only buttons
- Focus states: `focus:ring-2 focus:ring-[#0d7377] focus:ring-offset-2`

---

## TailwindCSS Classes Reference

### Colors
- `text-[#0d7377]` - Primary text/borders
- `bg-[#0d7377]` - Primary backgrounds
- `hover:bg-[#0a5c5f]` - Primary hover
- `text-[#e85d5d]` - Accent/destructive
- `bg-[#f5f5f0]` - Secondary/muted backgrounds
- `text-[#2d2d2d]` - Primary text
- `text-[#666666]` - Secondary text
- `border-[#e5e5e0]` - Borders

### Spacing
- `p-4`, `px-4`, `py-2` - Padding
- `m-4`, `mb-8`, `mt-4` - Margins
- `gap-4`, `gap-6` - Gaps

### Typography
- `text-sm`, `text-xs`, `text-lg`, `text-2xl` - Font sizes
- `font-medium`, `font-semibold`, `font-bold` - Font weights
- `text-center` - Text alignment

### Borders
- `border`, `border-2`, `border-[#e5e5e0]` - Border styles
- `rounded`, `rounded-lg`, `rounded-xl`, `rounded-full` - Border radius

---

## Implementation

Colors are defined as CSS custom properties in `src/app/globals.css`:

```css
:root {
  --primary: #0d7377;
  --primary-foreground: #ffffff;
  --accent: #e85d5d;
  --accent-foreground: #ffffff;
  --background: #ffffff;
  --foreground: #2d2d2d;
  --muted: #f5f5f0;
  --muted-foreground: #666666;
  /* ... */
}
```

Font is loaded in `src/app/layout.tsx` using next/font/google with Montserrat.

Use Tailwind's arbitrary value syntax or CSS variables to apply these colors.
