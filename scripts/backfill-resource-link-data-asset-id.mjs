/**
 * One-time migration: add data-asset-id="<uuid>" to <a class="resource-link">
 * tags in lesson content fields, and rewrite any href that points to a
 * stale URL to the current assets.public_url.
 *
 * Why: Previously, inserting a resource link in the TipTap editor wrote the
 * asset's absolute public_url directly into the lesson HTML. When an admin
 * replaced a file via the new "Replace File" UI, the URL was overwritten on
 * the assets row but the URL embedded in lesson HTML was left pointing at
 * the now-deleted storage object. Going forward, new links include
 * data-asset-id="<uuid>" and the lesson view click handler resolves the
 * asset by ID.
 *
 * Run: node scripts/backfill-resource-link-data-asset-id.mjs [--dry-run]
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, "..", ".env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
});

const CONTENT_FIELDS = [
  "lesson_outline",
  "learning_objectives",
  "vocabulary",
  "materials",
  "vapa_text_block",
  "ncas_text_block",
  "welcome_opening",
  "actual_class_expectations",
  "warm_up",
  "lesson_hook",
  "main_activity",
  "instrument_expectations",
  "reflection",
  "closing_ceremony",
  "assessment",
];

function extractStorageFilename(url) {
  // URL form: .../curriculum-assets/assets/{timestamp}-{filename}
  // Returns the `assets/{...}` portion so that a replaced file's old URL
  // (different timestamp) still collides with its new URL by filename.
  const m = /\/curriculum-assets\/(.+?)(?:#|$|\?)/.exec(url);
  return m ? m[1] : null;
}

async function fetchAllAssets() {
  let all = [];
  let from = 0;
  const PAGE = 1000;
  // Try with previous_public_urls first; fall back to base columns if the
  // migration hasn't been applied yet.
  let selectFields = "id, public_url, filename, created_at, previous_public_urls";
  while (true) {
    const { data, error } = await supabase
      .from("assets")
      .select(selectFields)
      .order("created_at", { ascending: false })
      .range(from, from + PAGE - 1);
    if (error) {
      if (selectFields.includes("previous_public_urls")) {
        console.warn(
          "Note: previous_public_urls column not present yet. Run supabase/migrations/033_assets_previous_public_urls.sql to enable it. Continuing without it."
        );
        selectFields = "id, public_url, filename, created_at";
        continue;
      }
      throw error;
    }
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

async function fetchAllLessons(fields) {
  let all = [];
  let from = 0;
  const PAGE = 100;
  while (true) {
    const { data, error } = await supabase
      .from("lessons")
      .select(`id, ${fields.join(", ")}`)
      .range(from, from + PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

function processFieldHtml(html, urlToAsset, filenameToAsset, stats) {
  // Returns { html, changed } where html is the rewritten content (or the
  // original if no changes were needed).
  if (!html || typeof html !== "string") return { html, changed: false };
  if (!/<a\b[^>]*class\s*=\s*["'][^"']*\bresource-link\b/i.test(html)) {
    return { html, changed: false };
  }

  let changed = false;
  const newHtml = html.replace(/<a\b([^>]*)>/g, (match, attrs) => {
    const classMatch = /\bclass\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(attrs);
    const classValue = classMatch ? classMatch[1] || classMatch[2] : "";
    if (!classValue.split(/\s+/).includes("resource-link")) return match;
    if (/\bdata-asset-id\s*=\s*(?:"[^"]*"|'[^']*')/i.test(attrs)) {
      stats.skipped++;
      return match;
    }

    const hrefMatch = /\bhref\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(attrs);
    const href = hrefMatch ? hrefMatch[1] || hrefMatch[2] : "";
    if (!href) {
      stats.skipped++;
      return match;
    }

    let asset = urlToAsset.get(href);
    let kind = "byUrl";
    if (!asset) {
      const filenameKey = extractStorageFilename(href);
      if (filenameKey && filenameToAsset.has(filenameKey)) {
        asset = filenameToAsset.get(filenameKey);
        kind = "byFilename";
      }
    }
    if (!asset) {
      stats.skipped++;
      return match;
    }

    stats[kind]++;
    stats.total++;

    let newAttrs = attrs;
    if (href !== asset.public_url) {
      newAttrs = newAttrs.replace(
        /\bhref\s*=\s*(?:"[^"]*"|'[^']*')/i,
        `href="${asset.public_url.replace(/"/g, "&quot;")}"`
      );
    }
    newAttrs = `${newAttrs} data-asset-id="${asset.id}"`;
    changed = true;
    return `<a${newAttrs}>`;
  });

  return { html: newHtml, changed };
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  console.log(`Backfilling resource-link data-asset-id${dryRun ? " (DRY RUN)" : ""}...`);

  const assets = await fetchAllAssets();
  console.log(`Fetched ${assets.length} assets.`);

  // Map current public_url -> asset, and previous_public_urls entries -> asset.
  // Newer assets (later created_at) override older ones when URLs collide.
  const urlToAsset = new Map();
  for (const a of assets) {
    if (a.public_url) urlToAsset.set(a.public_url, a);
  }
  for (const a of assets) {
    if (Array.isArray(a.previous_public_urls)) {
      for (const oldUrl of a.previous_public_urls) {
        if (!urlToAsset.has(oldUrl)) urlToAsset.set(oldUrl, a);
      }
    }
  }

  // Filename-based fallback for replaced assets: any URL whose path ends in
  // `assets/{filename}` (ignoring the timestamp prefix) maps to that asset.
  const filenameToAsset = new Map();
  for (const a of assets) {
    if (!a.public_url) continue;
    const key = extractStorageFilename(a.public_url);
    if (key) filenameToAsset.set(key, a);
  }

  const lessons = await fetchAllLessons(CONTENT_FIELDS);
  console.log(`Fetched ${lessons.length} lessons.`);

  const stats = { total: 0, byUrl: 0, byFilename: 0, byPreviousUrl: 0, skipped: 0 };
  let lessonsUpdated = 0;

  for (const lesson of lessons) {
    const updates = {};
    let lessonChanged = false;

    for (const field of CONTENT_FIELDS) {
      const { html, changed } = processFieldHtml(
        lesson[field],
        urlToAsset,
        filenameToAsset,
        stats
      );
      if (changed) {
        updates[field] = html;
        lessonChanged = true;
      }
    }

    if (lessonChanged) {
      lessonsUpdated++;
      if (!dryRun) {
        const { error } = await supabase
          .from("lessons")
          .update(updates)
          .eq("id", lesson.id);
        if (error) {
          console.error(`Failed to update lesson ${lesson.id}:`, error.message);
        }
      }
    }
  }

  console.log("\n=== Summary ===");
  console.log(`Tag rewrites:        ${stats.total}`);
  console.log(`  By current URL:    ${stats.byUrl}`);
  console.log(`  By previous URL:   ${stats.byPreviousUrl}`);
  console.log(`  By filename match: ${stats.byFilename}  (replaced assets)`);
  console.log(`  Skipped:           ${stats.skipped}`);
  console.log(`Lessons updated:     ${lessonsUpdated}${dryRun ? " (dry run, not written)" : ""}`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
