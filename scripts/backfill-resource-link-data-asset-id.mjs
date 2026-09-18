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
 * Match strategies (in priority order):
 *   0. By current public_url — exact match (covers un-replaced assets)
 *   1. By previous_public_urls — exact match against historical URLs
 *   2. By filename substring — strips the timestamp prefix and matches on
 *      the trailing filename fragment (catches replaces where the
 *      sanitized filename is identical between old and new)
 *   3. By display-name tie-break — for unmatched orphans, parses the link
 *      text and matches against assets.display_name with strict rules:
 *        - exact match (case-insensitive, whitespace-normalized) → accept
 *        - link text contains full display_name AND display_name >= 8
 *          chars AND display_name is unique across current assets → accept
 *        - else → orphan (logged to scripts/orphaned-resource-links-report.json)
 *
 * Run: node scripts/backfill-resource-link-data-asset-id.mjs [--dry-run|--write]
 *
 * Default mode is dry-run (no DB writes). Pass --write to commit changes.
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as fs from "fs";
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

const REPORT_PATH = resolve(__dirname, "orphaned-resource-links-report.json");
const LOG_PATH = resolve(__dirname, "rewrite-log.json");

function extractStorageFilename(url) {
  // URL form: .../curriculum-assets/assets/{timestamp}-{filename}
  // Returns the `assets/{...}` portion so that a replaced file's old URL
  // (different timestamp) still collides with its new URL by filename.
  const m = /\/curriculum-assets\/(.+?)(?:#|$|\?)/.exec(url);
  return m ? m[1] : null;
}

function extractFilenameFragment(storagePath) {
  // storagePath form: assets/{timestamp}-{filename}
  // Strip the leading timestamp prefix (13-digit epoch ms + hyphen) so
  // old and new URLs collapse to the same fragment.
  if (!storagePath) return null;
  const m = /^assets\/\d+-(.+)$/.exec(storagePath);
  return m ? m[1] : null;
}

function normalizeText(text) {
  return (text || "").replace(/\s+/g, " ").trim().toLowerCase();
}

function extractLinkText(html, anchorEndIdx) {
  // Find the closing </a> after anchorEndIdx and return the inner text,
  // stripping nested tags.
  const closeIdx = html.indexOf("</a>", anchorEndIdx);
  if (closeIdx === -1) return "";
  const inner = html.slice(anchorEndIdx, closeIdx);
  return inner.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

async function fetchAllAssets() {
  let all = [];
  let from = 0;
  const PAGE = 1000;
  let selectFields = "id, public_url, filename, display_name, created_at, previous_public_urls";
  while (true) {
    const { data, error } = await supabase
      .from("assets")
      .select(selectFields)
      .order("created_at", { ascending: false })
      .range(from, from + PAGE - 1);
    if (error) {
      if (selectFields.includes("previous_public_urls")) {
        console.warn(
          "Note: previous_public_urls column not present. Continuing without Strategy 1."
        );
        selectFields = "id, public_url, filename, display_name, created_at";
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
      .select(`id, title, ${fields.join(", ")}`)
      .range(from, from + PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

function processFieldHtml(html, ctx, stats, rewrites, orphans, lesson, field) {
  // Returns { html, changed }
  if (!html || typeof html !== "string") return { html, changed: false };
  if (!/<a\b[^>]*class\s*=\s*["'][^"']*\bresource-link\b/i.test(html)) {
    return { html, changed: false };
  }

  let changed = false;
  const newHtml = html.replace(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi, (match, attrs, inner, offset) => {
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

    const anchorEndIdx = offset + match.length - inner.length - 4; // -4 for </a>
    const linkText = extractLinkText(html, anchorEndIdx);

    let asset = null;
    let strategy = null;

    // Strategy 0: exact current public_url match
    asset = ctx.urlToAsset.get(href);
    if (asset) strategy = "byUrl";

    // Strategy 1: exact previous_public_urls match
    if (!asset) {
      asset = ctx.previousUrlToAsset.get(href);
      if (asset) strategy = "byPreviousUrl";
    }

    // Strategy 2: filename substring match (filename fragment unique across assets)
    if (!asset) {
      const oldStoragePath = extractStorageFilename(href);
      const oldFragment = extractFilenameFragment(oldStoragePath);
      if (oldFragment) {
        const candidate = ctx.fragmentToAsset.get(oldFragment);
        if (candidate && ctx.fragmentUniqueness.get(oldFragment) === 1) {
          asset = candidate;
          strategy = "byFilename";
        }
      }
    }

    // Strategy 3: display-name tie-break
    if (!asset && linkText) {
      const normText = normalizeText(linkText);

      // Exact match
      const exactCandidates = ctx.displayNameExact.get(normText) || [];
      if (exactCandidates.length === 1) {
        asset = exactCandidates[0];
        strategy = "byDisplayNameExact";
      } else if (exactCandidates.length > 1) {
        // Multiple assets share this display name — ambiguous, fall through to substring
      }

      // Unique substring match (display_name >= 4 chars, unique across assets
      // whose display_name contains the link text). For example, link text
      // "Jambo" matches the unique asset whose display_name is "Jambo Sana".
      if (!asset) {
        const candidates = [];
        for (const a of ctx.assets) {
          const dn = a.display_name ? normalizeText(a.display_name) : "";
          if (dn.length >= 4 && dn.includes(normText)) {
            candidates.push(a);
          }
        }
        if (candidates.length === 1) {
          asset = candidates[0];
          strategy = "byDisplayNameSubstring";
        }
      }

      // For reporting: gather suspected matches even if not accepted
      if (!asset) {
        const suspected = [];
        for (const a of ctx.assets) {
          const dn = a.display_name ? normalizeText(a.display_name) : "";
          if (dn && dn.includes(normText)) suspected.push(a.display_name);
        }
        if (suspected.length > 0) {
          if (!ctx.suspectedByLesson) ctx.suspectedByLesson = new Map();
          const key = `${lesson.id}:${field}:${offset}`;
          ctx.suspectedByLesson.set(key, suspected.slice(0, 5));
        }
      }
    }

    if (!asset) {
      stats.orphans++;
      orphans.push({
        lesson_id: lesson.id,
        lesson_title: lesson.title,
        field,
        broken_href: href,
        link_text: linkText,
      });
      return match;
    }

    stats[strategy]++;
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

    rewrites.push({
      lesson_id: lesson.id,
      lesson_title: lesson.title,
      field,
      strategy,
      asset_id: asset.id,
      asset_display_name: asset.display_name,
      old_href: href,
      new_href: asset.public_url,
    });

    return `<a${newAttrs}>${inner}</a>`;
  });

  return { html: newHtml, changed };
}

function buildContext(assets) {
  const urlToAsset = new Map();
  for (const a of assets) {
    if (a.public_url) urlToAsset.set(a.public_url, a);
  }

  const previousUrlToAsset = new Map();
  for (const a of assets) {
    if (Array.isArray(a.previous_public_urls)) {
      for (const oldUrl of a.previous_public_urls) {
        if (!previousUrlToAsset.has(oldUrl)) previousUrlToAsset.set(oldUrl, a);
      }
    }
  }

  // Keyed by the filename fragment (timestamp stripped), not the full storage
  // path, so old and new URLs of the same file collapse to one key.
  const fragmentToAsset = new Map();
  const fragmentCounts = new Map();
  for (const a of assets) {
    if (!a.public_url) continue;
    const storagePath = extractStorageFilename(a.public_url);
    const fragment = extractFilenameFragment(storagePath);
    if (!fragment) continue;
    fragmentToAsset.set(fragment, a);
    fragmentCounts.set(fragment, (fragmentCounts.get(fragment) || 0) + 1);
  }
  const fragmentUniqueness = new Map();
  for (const [frag, count] of fragmentCounts) {
    fragmentUniqueness.set(frag, count);
  }

  const displayNameExact = new Map();
  const displayNameCounts = new Map();
  const displayNameToAsset = new Map();
  for (const a of assets) {
    const dn = a.display_name ? normalizeText(a.display_name) : "";
    if (!dn) continue;
    if (!displayNameExact.has(dn)) displayNameExact.set(dn, []);
    displayNameExact.get(dn).push(a);
    displayNameCounts.set(dn, (displayNameCounts.get(dn) || 0) + 1);
    displayNameToAsset.set(dn, a);
  }
  const uniqueDisplayNamesAtLeast8 = [];
  const allDisplayNames = [];
  for (const [dn, count] of displayNameCounts) {
    allDisplayNames.push(dn);
    if (count === 1 && dn.length >= 8) uniqueDisplayNamesAtLeast8.push(dn);
  }

  return {
    urlToAsset,
    previousUrlToAsset,
    fragmentToAsset,
    fragmentUniqueness,
    displayNameExact,
    displayNameToAsset,
    uniqueDisplayNamesAtLeast8,
    allDisplayNames,
    assets,
  };
}

function groupOrphansByAsset(orphans, assets) {
  const assetByDisplayName = new Map();
  for (const a of assets) {
    if (a.display_name) {
      assetByDisplayName.set(a.display_name, a);
    }
  }
  const groups = new Map();
  for (const orphan of orphans) {
    // Heuristic: try to attribute orphans to an asset by link_text matching
    // an asset display name. Falls back to "(unattributed)".
    const normText = normalizeText(orphan.link_text);
    let attributedTo = null;
    for (const a of assets) {
      if (a.display_name && normText.includes(normalizeText(a.display_name))) {
        attributedTo = a;
        break;
      }
    }
    const key = attributedTo
      ? `${attributedTo.display_name} (${attributedTo.id})`
      : "(unattributed)";
    if (!groups.has(key)) {
      groups.set(key, {
        asset_id: attributedTo?.id || null,
        asset_display_name: attributedTo?.display_name || null,
        orphan_count: 0,
        lessons: new Set(),
        orphans: [],
      });
    }
    const group = groups.get(key);
    group.orphan_count++;
    group.lessons.add(orphan.lesson_id);
    group.orphans.push(orphan);
  }
  const result = [];
  for (const [key, group] of groups) {
    result.push({
      group_key: key,
      asset_id: group.asset_id,
      asset_display_name: group.asset_display_name,
      orphan_count: group.orphan_count,
      lesson_count: group.lessons.size,
      lesson_ids: [...group.lessons],
      orphans: group.orphans,
    });
  }
  result.sort((a, b) => b.orphan_count - a.orphan_count);
  return result;
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const isWrite = args.has("--write");
  const isDryRun = args.has("--dry-run") || !isWrite;
  console.log(
    `Backfilling resource-link data-asset-id (${isWrite ? "WRITE" : "DRY RUN"})...`
  );

  const assets = await fetchAllAssets();
  console.log(`Fetched ${assets.length} assets.`);
  const ctx = buildContext(assets);
  console.log(
    `Indexed ${ctx.urlToAsset.size} URLs, ${ctx.previousUrlToAsset.size} previous URLs, ${ctx.fragmentToAsset.size} filename fragments, ${ctx.uniqueDisplayNamesAtLeast8.length} unique display names >= 8 chars.`
  );

  const lessons = await fetchAllLessons(CONTENT_FIELDS);
  console.log(`Fetched ${lessons.length} lessons.`);

  const stats = {
    total: 0,
    byUrl: 0,
    byPreviousUrl: 0,
    byFilename: 0,
    byDisplayNameExact: 0,
    byDisplayNameSubstring: 0,
    skipped: 0,
    orphans: 0,
  };
  const rewrites = [];
  const orphans = [];
  let lessonsUpdated = 0;

  for (const lesson of lessons) {
    const updates = {};
    let lessonChanged = false;

    for (const field of CONTENT_FIELDS) {
      const { html, changed } = processFieldHtml(
        lesson[field],
        ctx,
        stats,
        rewrites,
        orphans,
        lesson,
        field
      );
      if (changed) {
        updates[field] = html;
        lessonChanged = true;
      }
    }

    if (lessonChanged) {
      lessonsUpdated++;
      if (isWrite) {
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
  console.log(`Tag rewrites:                ${stats.total}`);
  console.log(`  By current URL:            ${stats.byUrl}`);
  console.log(`  By previous URL:           ${stats.byPreviousUrl}`);
  console.log(`  By filename match:         ${stats.byFilename}  (replaced assets)`);
  console.log(`  By display name (exact):   ${stats.byDisplayNameExact}`);
  console.log(`  By display name (substr):  ${stats.byDisplayNameSubstring}`);
  console.log(`Orphans remaining:           ${stats.orphans}`);
  console.log(`Lessons updated:             ${lessonsUpdated}${isWrite ? "" : " (dry run, not written)"}`);

  fs.writeFileSync(LOG_PATH, JSON.stringify({ stats, rewrites }, null, 2));
  console.log(`\nRewrite log: ${LOG_PATH}`);

  if (orphans.length > 0) {
    const grouped = groupOrphansByAsset(orphans, assets);
    fs.writeFileSync(REPORT_PATH, JSON.stringify(grouped, null, 2));
    console.log(`Orphan report: ${REPORT_PATH}`);
  } else {
    if (fs.existsSync(REPORT_PATH)) fs.unlinkSync(REPORT_PATH);
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
