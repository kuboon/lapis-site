import { extract } from "@std/front-matter/yaml";
import { fromFileUrl, join } from "@std/path";

/** Directory of Markdown content, organised into category subfolders. */
const CONTENT_DIR = fromFileUrl(new URL("../content/", import.meta.url));

/** The content categories, each a subfolder of `content/`. */
export type Category = "about" | "works" | "training" | "blog" | "pages";

/** A Markdown document: frontmatter metadata plus the Markdown body. */
export interface Doc {
  category: Category;
  slug: string;
  title: string;
  /** Publish date (`YYYY-MM-DD`), or `""` when unknown. */
  date: string;
  /** Production year, for `works`. `""` otherwise. */
  year: string;
  /** The original WordPress URL this page was migrated from. */
  originalUrl: string;
  /** A short plain-text excerpt derived from the body. */
  summary: string;
  /** The first image in the body (a root-relative `/static/…` path), or `""`. */
  image: string;
  /** The Markdown body (frontmatter removed). */
  body: string;
}

function str(v: unknown): string {
  return typeof v === "string" ? v : typeof v === "number" ? String(v) : "";
}

/** Derives a short plain-text summary from a Markdown body. */
function summarize(body: string): string {
  for (const block of body.split(/\n\s*\n/)) {
    const text = block
      .replace(/!\[[^\]]*\]\([^)]*\)/g, "") // images
      .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // links → text
      .replace(/[#>*_`~-]/g, "") // markdown punctuation
      .replace(/https?:\/\/\S+/g, "") // bare URLs (embeds)
      .replace(/\s+/g, " ")
      .trim();
    if (text.length >= 12) {
      return text.length > 160 ? text.slice(0, 159).trimEnd() + "…" : text;
    }
  }
  return "";
}

/** The first image in a Markdown body: the full-size target of a linked
 * thumbnail (`[![](thumb)](full)`) when there is one, else the image itself. */
function firstImage(body: string): string {
  const m = body.match(/!\[[^\]]*\]\(([^)\s]+)[^)]*\)(?:\]\(([^)\s]+)\))?/);
  if (!m) return "";
  const full = m[2];
  return full && /\.(jpe?g|png|gif|webp)$/i.test(full) ? full : m[1];
}

function parse(category: Category, slug: string, text: string): Doc {
  const { attrs, body } = extract(text);
  const a = attrs as Record<string, unknown>;
  return {
    category,
    slug,
    title: str(a.title) || slug,
    date: str(a.date),
    year: str(a.year),
    originalUrl: str(a.original_url),
    summary: summarize(body),
    image: firstImage(body),
    body,
  };
}

/** Reads one document by category and slug, or `undefined` if absent. */
export async function getDoc(
  category: Category,
  slug: string,
): Promise<Doc | undefined> {
  if (!slug || slug.includes("/") || slug.includes("..")) return undefined;
  try {
    const text = await Deno.readTextFile(
      join(CONTENT_DIR, category, `${slug}.md`),
    );
    return parse(category, slug, text);
  } catch {
    return undefined;
  }
}

/** Reads every document in a category folder. */
export async function listDocs(category: Category): Promise<Doc[]> {
  const docs: Doc[] = [];
  try {
    const dir = join(CONTENT_DIR, category);
    for await (const entry of Deno.readDir(dir)) {
      if (!entry.isFile || !entry.name.endsWith(".md")) continue;
      docs.push(
        parse(
          category,
          entry.name.replace(/\.md$/, ""),
          await Deno.readTextFile(join(dir, entry.name)),
        ),
      );
    }
  } catch {
    return docs;
  }
  return docs;
}

/** Documents in a category, newest first (by date, then title). */
export async function listByDate(category: Category): Promise<Doc[]> {
  const docs = await listDocs(category);
  return docs.sort((a, b) =>
    b.date.localeCompare(a.date) || a.title.localeCompare(b.title)
  );
}

/** `works` documents grouped by year, newest year first. */
export async function worksByYear(): Promise<[string, Doc[]][]> {
  const docs = await listDocs("works");
  const groups = new Map<string, Doc[]>();
  for (const d of docs) {
    const y = d.year || "—";
    const list = groups.get(y) ?? [];
    if (!groups.has(y)) groups.set(y, list);
    list.push(d);
  }
  for (const list of groups.values()) {
    list.sort((a, b) => a.title.localeCompare(b.title));
  }
  return [...groups.entries()].sort((a, b) => b[0].localeCompare(a[0]));
}
