import { hastToRemix, markdownToHast } from "@kuboon/md";
import type { RemixNode } from "remix/ui";
import { base } from "./base.ts";

/**
 * Prefixes root-relative links in Markdown (e.g. `[…](/works/ondine)`) with the
 * deploy base path. Migrated content links are authored as plain `/works/…`
 * paths; under a sub-path deployment (a GitHub Pages project site or a per-PR
 * preview) they must carry the base prefix to resolve — otherwise the static
 * crawl 404s on them. Protocol-relative (`//host`), absolute (`https://`),
 * hash, and `mailto:` targets are left untouched.
 */
function baseifyLinks(markdown: string): string {
  return base ? markdown.replace(/(\]\()\/(?!\/)/g, `$1${base}/`) : markdown;
}

/**
 * Renders a Markdown string to a Remix UI node tree, ready to place inside a
 * page. `@kuboon/md` parses GitHub-flavored Markdown into a sanitized hast tree
 * (heading anchors, Shiki-highlighted code, tables, task lists) and
 * `hastToRemix` converts it to `remix/ui` elements.
 */
export async function renderMarkdown(markdown: string): Promise<RemixNode> {
  const hast = await markdownToHast(baseifyLinks(markdown));
  return hastToRemix(hast) as RemixNode;
}
