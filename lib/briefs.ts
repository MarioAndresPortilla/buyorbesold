import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import matter from "gray-matter";
import type { Brief, BriefMeta, BriefType } from "./types";

/**
 * Briefs live as Markdown files under `content/briefings/*.md`.
 *
 * Frontmatter:
 *   ---
 *   title: string (required)
 *   date:  YYYY-MM-DD (required)
 *   summary: string (required, 1–2 sentences)
 *   tags: [string] (optional)
 *   type: brief | earnings | event | setup | macro (optional, defaults to "brief")
 *   # Any additional frontmatter fields are dumped into `meta` — used by
 *   # typed briefs (earnings: ticker/epsActual/epsEst/revActual/revEst,
 *   # event: consensus/actual, setup: entry/stop/target, …) without the
 *   # parser needing to know each type's schema.
 *   ---
 *
 * Body content becomes the "take" — Mario's voice, his call, his reasoning.
 * The slug is derived from the filename (without .md).
 *
 * Parsed eagerly at module load and cached in-process. Next.js will re-run
 * this module on each deploy, so new markdown files show up after `git push`.
 *
 * Files whose name starts with `_` (and the entire `_drafts/` subfolder via
 * its top-level directory entry) are ignored so Mario can keep Claude-drafted
 * markdown alongside published briefs without it leaking to production.
 */

const BRIEFS_DIR = join(process.cwd(), "content", "briefings");

const VALID_TYPES: readonly BriefType[] = [
  "brief",
  "earnings",
  "event",
  "setup",
  "macro",
];

// Reserved frontmatter keys that don't flow into `meta`.
const RESERVED_KEYS = new Set(["title", "date", "summary", "tags", "type"]);

let cached: Brief[] | null = null;

function parseFile(filename: string): Brief | null {
  try {
    const full = join(BRIEFS_DIR, filename);
    const raw = readFileSync(full, "utf8");
    const { data, content } = matter(raw);

    const title = typeof data.title === "string" ? data.title.trim() : "";
    const summary = typeof data.summary === "string" ? data.summary.trim() : "";
    const take = content.trim();

    let date = "";
    if (typeof data.date === "string") date = data.date;
    else if (data.date instanceof Date) date = data.date.toISOString().slice(0, 10);

    const tags = Array.isArray(data.tags)
      ? data.tags
          .filter((t): t is string => typeof t === "string")
          .map((t) => t.trim())
          .filter(Boolean)
      : [];

    // Default to "brief" when `type` is missing or invalid — backward compat
    // so existing hand-written briefs continue to parse unchanged.
    const rawType =
      typeof data.type === "string" ? data.type.trim().toLowerCase() : "";
    const type: BriefType = (VALID_TYPES as readonly string[]).includes(rawType)
      ? (rawType as BriefType)
      : "brief";

    // Everything in frontmatter that isn't a reserved key becomes `meta`.
    // Lets earnings/event/setup briefs carry structured fields (ticker,
    // epsActual, consensus, entry, stop, …) without the parser caring.
    const metaEntries: [string, unknown][] = [];
    for (const [k, v] of Object.entries(data)) {
      if (RESERVED_KEYS.has(k)) continue;
      if (v === undefined || v === null) continue;
      metaEntries.push([k, v instanceof Date ? v.toISOString() : v]);
    }
    const meta: BriefMeta | undefined =
      metaEntries.length > 0
        ? (Object.fromEntries(metaEntries) as BriefMeta)
        : undefined;

    if (!title || !date || !summary || !take) {
      console.warn(`[briefs] skipping ${filename}: missing required frontmatter`);
      return null;
    }

    return {
      slug: filename.replace(/\.md$/, ""),
      date,
      title,
      summary,
      take,
      tags,
      type,
      meta,
    };
  } catch (err) {
    console.warn(`[briefs] parse fail ${filename}:`, err);
    return null;
  }
}

function loadAll(): Brief[] {
  if (cached) return cached;
  let files: string[] = [];
  try {
    // Skip anything whose name starts with `_` — covers the `_drafts/`
    // subdirectory entry and any loose `_draft-foo.md` file Mario drops in.
    files = readdirSync(BRIEFS_DIR).filter(
      (f) => f.endsWith(".md") && !f.startsWith("_")
    );
  } catch (err) {
    console.warn("[briefs] content/briefings not readable:", err);
    files = [];
  }
  const briefs = files
    .map(parseFile)
    .filter((b): b is Brief => b !== null)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  cached = briefs;
  return briefs;
}

// Re-exported for anywhere that still imports `BRIEFS` directly.
// Acts as a snapshot at first access.
export const BRIEFS: Brief[] = loadAll();

export function getBriefs(): Brief[] {
  return [...loadAll()];
}

/**
 * Return only briefs of a specific type. Briefs without an explicit `type`
 * frontmatter field are treated as `"brief"` (backward compatibility).
 */
export function getBriefsByType(type: BriefType): Brief[] {
  return loadAll().filter((b) => (b.type ?? "brief") === type);
}

export function getLatestBrief(): Brief {
  const all = loadAll();
  if (all.length === 0) {
    // Fallback so the homepage never crashes on a fresh install.
    return {
      slug: "placeholder",
      date: new Date().toISOString().slice(0, 10),
      title: "No briefs published yet",
      summary: "Check back soon — the first brief drops shortly.",
      take: "This is a placeholder that appears when no markdown briefs are present in content/briefings/.",
      tags: [],
      type: "brief",
    };
  }
  return all[0];
}

export function getBriefBySlug(slug: string): Brief | undefined {
  return loadAll().find((b) => b.slug === slug);
}

/**
 * Collect the set of unique tags across all briefs, sorted by frequency
 * (most-used first). Used to populate the tag filter chips on /briefings.
 */
export function getAllTags(): Array<{ tag: string; count: number }> {
  const counts = new Map<string, number>();
  for (const b of loadAll()) {
    for (const tag of b.tags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

// ---- Async versions that merge filesystem + AI-generated (KV) briefs ----
// These are needed by pages that want to show both hand-written markdown
// briefs AND cron-generated AI briefs in one feed.

import { getAiBrief, listAiBriefs } from "./kv";

/**
 * Merges filesystem briefs with KV-stored AI briefs, deduped by slug,
 * newest first. Filesystem briefs take precedence when slugs collide
 * (so you can override an AI brief by committing a .md with the same slug).
 */
export async function getAllBriefs(): Promise<Brief[]> {
  const fsBriefs = loadAll();
  const aiBriefs = await listAiBriefs(50);

  const slugs = new Set(fsBriefs.map((b) => b.slug));
  const merged = [
    ...fsBriefs,
    ...aiBriefs.filter((b) => !slugs.has(b.slug)),
  ];
  return merged.sort((a, b) => (a.date < b.date ? 1 : -1));
}

/**
 * Async version of getLatestBrief that also checks KV for AI briefs.
 */
export async function getLatestBriefAsync(): Promise<Brief> {
  const all = await getAllBriefs();
  if (all.length === 0) return getLatestBrief(); // fallback placeholder
  return all[0];
}

/**
 * Async slug lookup that checks both filesystem and KV.
 */
export async function getBriefBySlugAsync(slug: string): Promise<Brief | undefined> {
  // Check filesystem first (takes precedence).
  const fsBrief = getBriefBySlug(slug);
  if (fsBrief) return fsBrief;
  // Then check KV for AI-generated briefs.
  const aiBrief = await getAiBrief(slug);
  return aiBrief ?? undefined;
}

/**
 * Async version of getAllTags that includes AI brief tags.
 */
export async function getAllTagsAsync(): Promise<Array<{ tag: string; count: number }>> {
  const all = await getAllBriefs();
  const counts = new Map<string, number>();
  for (const b of all) {
    for (const tag of b.tags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}
