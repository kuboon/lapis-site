/**
 * Static build: crawl the router from the home page and write every response
 * to `dist/`.
 *
 * We use the runtime-agnostic `crawl` + `toOutput` from @kuboon/remix-ssg (rather
 * than the batteries-included `prerender`) for one reason: when the site is
 * hosted under a base path, routes and links carry that prefix, but the files
 * must still land at the site root. So we strip the base prefix from each output
 * path before writing. See src/base.ts.
 */
import { dirname, join } from "@std/path";
import { crawl, type CrawlFailure, toOutput } from "@kuboon/remix-ssg";
import { router } from "../src/router.tsx";
import { routes } from "../src/routes.ts";
import { base } from "../src/base.ts";

const OUT_DIR = new URL("../dist/", import.meta.url);

function stripBase(outputPath: string): string {
  let path = outputPath.replace(/^\/+/, "");
  if (base) {
    const prefix = base.replace(/^\//, "") + "/";
    if (path.startsWith(prefix)) path = path.slice(prefix.length);
  }
  return path;
}

async function main() {
  await Deno.remove(OUT_DIR, { recursive: true }).catch(() => {});

  let pages = 0;
  let assets = 0;
  const broken: CrawlFailure[] = [];

  // Seed from the (base-aware) home path; every other page is reached by
  // crawling. A broken internal link is reported and skipped rather than
  // aborting the whole build — see the summary printed below.
  for await (
    const result of crawl(router, {
      paths: [routes.home.href()],
      onError: (failure) => {
        broken.push(failure);
        return "skip";
      },
    })
  ) {
    const output = await toOutput(result);
    if (output == null) continue; // 204 No Content

    const relPath = stripBase(output.path);
    const destPath = join(new URL(OUT_DIR).pathname, relPath);
    await Deno.mkdir(dirname(destPath), { recursive: true });
    const bytes = typeof output.content === "string"
      ? new TextEncoder().encode(output.content)
      : output.content;
    await Deno.writeFile(destPath, bytes);

    if (relPath.endsWith(".html")) pages++;
    else assets++;
    console.log(`  ${relPath}`);
  }

  console.log(
    `\n✓ Wrote ${pages} page(s) and ${assets} asset(s) to dist/${
      base ? ` (base: ${base})` : ""
    }`,
  );

  if (broken.length > 0) {
    console.warn(`\n⚠ ${broken.length} broken link(s) skipped:`);
    for (const f of broken) {
      const from = f.referrer ? ` (linked from ${f.referrer})` : "";
      console.warn(`  ${f.status} ${f.pathname}${from}`);
    }
  }
}

await main();
