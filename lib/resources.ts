import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Resources = Mario's curated stack of tools, dealers, and data sources
 * that power his trading + bullion stack. Loaded from content/resources.json
 * so he can `git push` to update without a code deploy flow.
 *
 * Affiliate compliance (FTC 16 CFR Part 255):
 *   - Every `kind: "affiliate"` entry renders with a visible "Affiliate"
 *     badge on the card.
 *   - A disclosure block appears at the top of /resources explaining the
 *     relationship.
 *   - Affiliate anchors carry rel="sponsored" (spec-correct signal) plus
 *     nofollow + noopener. See ResourcesPage for the anchor rendering.
 */

export type ResourceKind = "affiliate" | "free" | "paid";

export interface ResourceItem {
  name: string;
  kind: ResourceKind;
  /** Plain, non-affiliate URL. Used when affiliateUrl is absent. */
  url: string;
  /** Affiliate-tagged URL; falls back to `url` if not set. */
  affiliateUrl?: string;
  blurb: string;
  bestFor?: string;
}

export interface ResourceCategory {
  code: string;
  name: string;
  blurb?: string;
  items: ResourceItem[];
}

export interface ResourcesFile {
  updatedAt: string;
  disclosure: string;
  categories: ResourceCategory[];
}

const PATH = join(process.cwd(), "content", "resources.json");

let cached: ResourcesFile | null = null;

export function loadResources(): ResourcesFile {
  if (cached) return cached;
  try {
    const raw = readFileSync(PATH, "utf8");
    const parsed = JSON.parse(raw) as ResourcesFile;
    cached = {
      updatedAt: parsed.updatedAt ?? "",
      disclosure: parsed.disclosure ?? "",
      // Filter out empty categories on the render side if the author hasn't
      // populated a section yet — keeps the page from showing empty cards.
      categories: (parsed.categories ?? []).map((c) => ({
        code: c.code,
        name: c.name,
        blurb: c.blurb,
        items: Array.isArray(c.items) ? c.items : [],
      })),
    };
    return cached;
  } catch (err) {
    console.warn("[resources] load fail:", err);
    cached = {
      updatedAt: "",
      disclosure: "",
      categories: [],
    };
    return cached;
  }
}

/** The URL an anchor should point at — prefers the affiliate variant. */
export function linkHref(item: ResourceItem): string {
  return item.kind === "affiliate" && item.affiliateUrl
    ? item.affiliateUrl
    : item.url;
}
