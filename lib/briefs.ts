import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import matter from "gray-matter";
import type { Brief } from "./types";

/**
 * Briefs live as Markdown files under `content/briefings/*.md`.
 *
 * Frontmatter:
 *   ---
 *   title: string (required)
 *   date:  YYYY-MM-DD (required)
 *   summary: string (required, 1–2 sentences)
 *   tags: [string] (optional)
 *   ---
 *
 * Body content becomes the "take" — Mario's voice, his call, his reasoning.
 * The slug is derived from the filename (without .md).
 *
 * Parsed eagerly at module load and cached in-process. Next.js will re-run
 * this module on each deploy, so new markdown files show up after `git push`.
 */

const BRIEFS_DIR = join(process.cwd(), "content", "briefings");

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
    files = readdirSync(BRIEFS_DIR).filter((f) => f.endsWith(".md"));
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
