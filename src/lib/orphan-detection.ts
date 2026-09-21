/**
 * Detection logic for orphaned resource links in lesson HTML.
 *
 * An "orphan" is a `<a class="resource-link">` tag whose `href` no longer
 * matches the current `assets.public_url` for any asset. This typically
 * happens when an admin uses the Replace File UI and the lesson HTML has a
 * hardcoded URL pointing to the now-deleted old storage object.
 *
 * Read-only: this module does not perform any mutations. The actual rewrites
 * are done by scripts/backfill-resource-link-data-asset-id.mjs against the
 * same detection logic.
 */

export type StrategyName =
  | "byUrl"
  | "byPreviousUrl"
  | "byFilename"
  | "byDisplayNameExact"
  | "byDisplayNameSubstring";

export type AssetInput = {
  id: string;
  public_url: string | null;
  filename: string | null;
  display_name: string | null;
  previous_public_urls?: string[] | null;
};

export type LessonInput = {
  id: string;
  title: string;
  course_id: string;
  [field: string]: unknown;
};

export type OrphanRecord = {
  lesson_id: string;
  lesson_title: string;
  course_id: string;
  field: string;
  broken_href: string;
  link_text: string;
};

export type OrphanReport = {
  scannedAt: string;
  stats: {
    lessonsScanned: number;
    fieldsScanned: number;
    tagsScanned: number;
    alreadyTagged: number;
    matchesByUrl: number;
    matchesByPreviousUrl: number;
    matchesByFilename: number;
    matchesByDisplayNameExact: number;
    matchesByDisplayNameSubstring: number;
    orphans: number;
  };
  orphans: OrphanRecord[];
  byFilenameFragment: Record<string, OrphanRecord[]>;
  byLesson: Record<string, OrphanRecord[]>;
  byField: Record<string, number>;
};

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

function extractStorageFilename(url: string): string | null {
  const m = /\/curriculum-assets\/(.+?)(?:#|$|\?)/.exec(url);
  return m ? m[1] : null;
}

function extractFilenameFragment(storagePath: string): string | null {
  const m = /^assets\/\d+-(.+)$/.exec(storagePath);
  return m ? m[1] : null;
}

function normalizeText(text: string): string {
  return (text || "").replace(/\s+/g, " ").trim().toLowerCase();
}

function extractLinkText(html: string, anchorEndIdx: number): string {
  const closeIdx = html.indexOf("</a>", anchorEndIdx);
  if (closeIdx === -1) return "";
  const inner = html.slice(anchorEndIdx, closeIdx);
  return inner.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

type MatchContext = {
  urlToAsset: Map<string, AssetInput>;
  previousUrlToAsset: Map<string, AssetInput>;
  fragmentToAsset: Map<string, AssetInput>;
  displayNameExact: Map<string, AssetInput[]>;
  displayNameToAsset: Map<string, AssetInput>;
  assets: AssetInput[];
};

function buildContext(assets: AssetInput[]): MatchContext {
  const urlToAsset = new Map<string, AssetInput>();
  for (const a of assets) {
    if (a.public_url) urlToAsset.set(a.public_url, a);
  }

  const previousUrlToAsset = new Map<string, AssetInput>();
  for (const a of assets) {
    if (Array.isArray(a.previous_public_urls)) {
      for (const oldUrl of a.previous_public_urls) {
        if (!previousUrlToAsset.has(oldUrl)) previousUrlToAsset.set(oldUrl, a);
      }
    }
  }

  const fragmentToAsset = new Map<string, AssetInput>();
  for (const a of assets) {
    const publicUrl = a.public_url;
    if (!publicUrl) continue;
    const storagePath = extractStorageFilename(publicUrl);
    if (!storagePath) continue;
    const fragment = extractFilenameFragment(storagePath);
    if (fragment) fragmentToAsset.set(fragment, a);
  }

  const displayNameExact = new Map<string, AssetInput[]>();
  const displayNameToAsset = new Map<string, AssetInput>();
  for (const a of assets) {
    const dn = a.display_name ? normalizeText(a.display_name) : "";
    if (!dn) continue;
    if (!displayNameExact.has(dn)) displayNameExact.set(dn, []);
    displayNameExact.get(dn)!.push(a);
    displayNameToAsset.set(dn, a);
  }

  return { urlToAsset, previousUrlToAsset, fragmentToAsset, displayNameExact, displayNameToAsset, assets };
}

type FieldScanResult = {
  tagsScanned: number;
  alreadyTagged: number;
  matchesByStrategy: Record<StrategyName, number>;
  orphans: OrphanRecord[];
};

function scanField(
  html: string | null | undefined,
  lesson: LessonInput,
  field: string,
  ctx: MatchContext
): FieldScanResult {
  const result: FieldScanResult = {
    tagsScanned: 0,
    alreadyTagged: 0,
    matchesByStrategy: {
      byUrl: 0,
      byPreviousUrl: 0,
      byFilename: 0,
      byDisplayNameExact: 0,
      byDisplayNameSubstring: 0,
    },
    orphans: [],
  };

  if (!html || typeof html !== "string") return result;

  const re = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    const attrs = match[1];
    const inner = match[2];
    const classMatch = /\bclass\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(attrs);
    const classValue = classMatch ? classMatch[1] || classMatch[2] : "";
    if (!classValue || !classValue.split(/\s+/).includes("resource-link")) continue;

    result.tagsScanned++;

    if (/\bdata-asset-id\s*=\s*(?:"[^"]*"|'[^']*')/i.test(attrs)) {
      result.alreadyTagged++;
      continue;
    }

    const hrefMatch = /\bhref\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(attrs);
    const href = hrefMatch ? hrefMatch[1] || hrefMatch[2] : "";
    if (!href) continue;

    const anchorEndIdx = match.index + match[0].length - inner.length - 4;
    const linkText = extractLinkText(html, anchorEndIdx);

    if (ctx.urlToAsset.has(href)) {
      result.matchesByStrategy.byUrl++;
      continue;
    }

    if (ctx.previousUrlToAsset.has(href)) {
      result.matchesByStrategy.byPreviousUrl++;
      continue;
    }

    const oldStoragePath = extractStorageFilename(href);
    const oldFragment = extractFilenameFragment(oldStoragePath || "");
    if (oldFragment && ctx.fragmentToAsset.has(oldFragment)) {
      result.matchesByStrategy.byFilename++;
      continue;
    }

    if (linkText) {
      const normText = normalizeText(linkText);
      const exact = ctx.displayNameExact.get(normText);
      if (exact && exact.length === 1) {
        result.matchesByStrategy.byDisplayNameExact++;
        continue;
      }

      const candidates: AssetInput[] = [];
      for (const a of ctx.assets) {
        const dn = a.display_name ? normalizeText(a.display_name) : "";
        if (dn.length >= 4 && dn.includes(normText)) candidates.push(a);
      }
      if (candidates.length === 1) {
        result.matchesByStrategy.byDisplayNameSubstring++;
        continue;
      }
    }

    result.orphans.push({
      lesson_id: lesson.id,
      lesson_title: lesson.title,
      course_id: lesson.course_id,
      field,
      broken_href: href,
      link_text: linkText,
    });
  }

  return result;
}

function extractFragmentFromHref(href: string): string {
  const storagePath = extractStorageFilename(href);
  if (!storagePath) return "(unknown)";
  const m = /^assets\/\d+-(.+?)(\.[a-z0-9]+)?$/i.exec(storagePath);
  return m ? m[1] : storagePath;
}

export function detectOrphanLinks(
  lessons: LessonInput[],
  assets: AssetInput[]
): OrphanReport {
  const ctx = buildContext(assets);
  const orphans: OrphanRecord[] = [];
  const byFilenameFragment: Record<string, OrphanRecord[]> = {};
  const byLesson: Record<string, OrphanRecord[]> = {};
  const byField: Record<string, number> = {};

  const stats = {
    lessonsScanned: lessons.length,
    fieldsScanned: 0,
    tagsScanned: 0,
    alreadyTagged: 0,
    matchesByUrl: 0,
    matchesByPreviousUrl: 0,
    matchesByFilename: 0,
    matchesByDisplayNameExact: 0,
    matchesByDisplayNameSubstring: 0,
    orphans: 0,
  };

  for (const lesson of lessons) {
    for (const field of CONTENT_FIELDS) {
      stats.fieldsScanned++;
      const fieldResult = scanField(lesson[field] as string | null | undefined, lesson, field, ctx);
      stats.tagsScanned += fieldResult.tagsScanned;
      stats.alreadyTagged += fieldResult.alreadyTagged;
      stats.matchesByUrl += fieldResult.matchesByStrategy.byUrl;
      stats.matchesByPreviousUrl += fieldResult.matchesByStrategy.byPreviousUrl;
      stats.matchesByFilename += fieldResult.matchesByStrategy.byFilename;
      stats.matchesByDisplayNameExact += fieldResult.matchesByStrategy.byDisplayNameExact;
      stats.matchesByDisplayNameSubstring += fieldResult.matchesByStrategy.byDisplayNameSubstring;

      for (const orphan of fieldResult.orphans) {
        orphans.push(orphan);
        stats.orphans++;
        byField[field] = (byField[field] || 0) + 1;

        const lessonKey = `${lesson.title} (${lesson.id})`;
        if (!byLesson[lessonKey]) byLesson[lessonKey] = [];
        byLesson[lessonKey].push(orphan);
      }
    }
  }

  for (const orphan of orphans) {
    const fragment = extractFragmentFromHref(orphan.broken_href);
    if (!byFilenameFragment[fragment]) byFilenameFragment[fragment] = [];
    byFilenameFragment[fragment].push(orphan);
  }

  return {
    scannedAt: new Date().toISOString(),
    stats,
    orphans,
    byFilenameFragment,
    byLesson,
    byField,
  };
}

export const ORPHAN_CONTENT_FIELDS = CONTENT_FIELDS;
