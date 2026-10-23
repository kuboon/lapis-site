import { createRouter, type RouteBuilder } from "remix/router";
import { createFileResponse } from "remix/response/file";
import { openLazyFile } from "remix/fs";
import { fromFileUrl, join } from "@std/path";
import { base } from "./base.ts";
import { routeGroup, routes } from "./routes.ts";
import { page } from "./layout.tsx";
import {
  type Category,
  type Doc,
  getDoc,
  listByDate,
  listDocs,
  worksByYear,
} from "./content.ts";
import { renderMarkdown } from "./markdown.ts";
import { Link } from "./link.tsx";
import { lapisLogo } from "./lapis-logo.ts";

/** Directory of static files served under `/static/*` (favicon, CSS, images, …). */
const STATIC_DIR = fromFileUrl(new URL("../static/", import.meta.url));

async function serveStatic(request: Request, rel: string): Promise<Response> {
  // Guard against path traversal before touching the filesystem.
  if (rel === "" || rel.includes("..")) {
    return new Response("Forbidden", { status: 403 });
  }
  const path = join(STATIC_DIR, rel);
  let info: Deno.FileInfo;
  try {
    info = await Deno.stat(path);
  } catch {
    return new Response("Not found", { status: 404 });
  }
  if (!info.isFile) {
    return new Response("Not found", { status: 404 });
  }
  return await createFileResponse(openLazyFile(path), request, {
    cacheControl: "public, max-age=3600",
  });
}

/** The body often carries its own top-level heading; the layout supplies one,
 * so drop a single leading `# …` line to avoid a duplicate <h1>. */
function stripLeadingH1(body: string): string {
  return body.replace(/^\s*#\s+.*(?:\n|$)/, "").trimStart();
}

/** Builds the `href` for a document based on its category. */
function docHref(d: Doc): string {
  switch (d.category) {
    case "about":
      return routes.about.show.href({ slug: d.slug });
    case "works":
      return routes.works.show.href({ slug: d.slug });
    case "training":
      return routes.training.show.href({ slug: d.slug });
    case "blog":
      return routes.blog.show.href({ slug: d.slug });
    case "pages":
      return routes.page.href({ slug: d.slug });
  }
}

/** Renders one Markdown document inside the page shell. */
async function docPage(d: Doc, backHref: string, backLabel: string) {
  const body = await renderMarkdown(stripLeadingH1(d.body));
  return page({
    title: `${d.title} — Théâtre Lapis`,
    description: d.summary,
    children: (
      <article class="doc">
        <header class="doc-head">
          <h1>{d.title}</h1>
          {d.year ? <p class="doc-meta">{d.year}</p> : null}
        </header>
        {body}
        <p class="doc-back">
          <Link href={backHref}>← {backLabel}</Link>
        </p>
      </article>
    ),
  });
}

export const router = createRouter();

router.mount(base || "/", (app: RouteBuilder) => {
  // Home + standalone info pages + static files.
  app.map(routeGroup, {
    actions: {
      home: async () => {
        const [latestYear] = await worksByYear();
        return page({
          title: "Théâtre Lapis",
          description:
            "Théâtre Lapis — theatre company led by artistic director Yojiro Ichikawa, bridging musical, physical and straight theatre across cultures.",
          scripts: [routes.static.href({ path: "spotlight.js" })],
          children: (
            <>
              <section class="marquee">
                <h1 class="marquee-title">
                  <svg
                    class="marquee-logo"
                    viewBox={lapisLogo.viewBox}
                    role="img"
                    aria-label="Théâtre Lapis"
                  >
                    <defs>
                      <radialGradient
                        id="marquee-lit"
                        gradientUnits="userSpaceOnUse"
                        cx="1570"
                        cy="-400"
                        r="2000"
                      >
                        <stop offset="0" />
                        <stop offset="0.2" />
                        <stop offset="0.55" />
                        <stop offset="1" />
                      </radialGradient>
                    </defs>
                    <path
                      transform={lapisLogo.transform}
                      d={lapisLogo.d}
                      fill="url(#marquee-lit)"
                    />
                  </svg>
                </h1>
              </section>
              <section class="hero">
                <p class="lead">
                  A theatre company led by artistic director{" "}
                  <Link
                    href={routes.about.show.href({ slug: "artistic-director" })}
                  >
                    Yojiro Ichikawa
                  </Link>, working across the UK, US and Japan to bridge
                  musical, physical and straight theatre — and the cultures they
                  come from.
                </p>
                <p class="lead lead-ja" lang="ja">
                  市川洋二郎が芸術監督を務める劇団。イギリス・アメリカ・日本を拠点に、
                  ミュージカル／フィジカルシアター／ストレートプレイ、そして東西の文化を
                  つなぐ作品を制作しています。
                </p>
                <p class="hero-actions">
                  <Link class="button" href={routes.works.index.href()}>
                    See our works →
                  </Link>
                </p>
              </section>

              {latestYear
                ? (
                  <section class="home-works">
                    <h2>Latest — {latestYear[0]}</h2>
                    <ul class="card-list">
                      {latestYear[1].map((d) => (
                        <li key={d.slug} class="card">
                          <Link href={docHref(d)}>{d.title}</Link>
                          {d.summary ? <p>{d.summary}</p> : null}
                        </li>
                      ))}
                    </ul>
                    <p>
                      <Link href={routes.works.index.href()}>
                        Browse the full history →
                      </Link>
                    </p>
                  </section>
                )
                : null}

              <section class="home-sections">
                <h2>Explore</h2>
                <ul class="link-grid">
                  <li>
                    <Link href={routes.about.index.href()}>About</Link>
                  </li>
                  <li>
                    <Link href={routes.training.index.href()}>
                      Training courses
                    </Link>
                  </li>
                  <li>
                    <Link href={routes.blog.index.href()}>News</Link>
                  </li>
                  <li>
                    <Link href={routes.page.href({ slug: "reviews" })}>
                      Reviews
                    </Link>
                  </li>
                  <li>
                    <Link href={routes.page.href({ slug: "gallery" })}>
                      Gallery
                    </Link>
                  </li>
                  <li>
                    <Link href={routes.page.href({ slug: "contact-us" })}>
                      Contact
                    </Link>
                  </li>
                </ul>
              </section>
            </>
          ),
        });
      },

      // Standalone info pages: content/pages/*.md
      page: async ({ params }) => {
        const d = await getDoc("pages", params.slug ?? "");
        if (!d) return new Response("Not found", { status: 404 });
        return docPage(d, routes.home.href(), "Home");
      },

      sitemap: async () => {
        const cats: [string, Category][] = [
          ["Works", "works"],
          ["About", "about"],
          ["Training", "training"],
          ["News", "blog"],
          ["Pages", "pages"],
        ];
        const sections = await Promise.all(
          cats.map(async ([label, cat]) => {
            const docs = await listByDate(cat);
            return { label, docs };
          }),
        );
        return page({
          title: "Site map — Théâtre Lapis",
          description: "Every page on the site.",
          children: (
            <>
              <h1>Site map</h1>
              {sections.map(({ label, docs }) => (
                <section key={label}>
                  <h2>{label}</h2>
                  <ul>
                    {docs.map((d) => (
                      <li key={d.slug}>
                        <Link href={docHref(d)}>{d.title}</Link>
                        {d.year
                          ? <span class="muted">{` · ${d.year}`}</span>
                          : null}
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </>
          ),
        });
      },

      static: ({ request, params }) => serveStatic(request, params.path ?? ""),
    },
  });

  // Works — productions grouped by year.
  app.map(routeGroup.works, {
    actions: {
      index: async () => {
        const groups = await worksByYear();
        return page({
          title: "Works — Théâtre Lapis",
          description: "Productions by Théâtre Lapis, year by year.",
          children: (
            <>
              <h1>Works</h1>
              {groups.map(([year, docs]) => (
                <section key={year} class="year-group">
                  <h2>{year}</h2>
                  <ul class="card-list">
                    {docs.map((d) => (
                      <li key={d.slug} class="card">
                        <Link href={routes.works.show.href({ slug: d.slug })}>
                          {d.title}
                        </Link>
                        {d.summary ? <p>{d.summary}</p> : null}
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </>
          ),
        });
      },
      show: async ({ params }) => {
        const d = await getDoc("works", params.slug ?? "");
        if (!d) return new Response("Not found", { status: 404 });
        return docPage(d, routes.works.index.href(), "All works");
      },
    },
  });

  // About — company & people.
  app.map(routeGroup.about, {
    actions: {
      index: async () => {
        const docs = await listDocs("about");
        docs.sort((a, b) => a.title.localeCompare(b.title));
        return page({
          title: "About — Théâtre Lapis",
          description: "About Théâtre Lapis and the people behind it.",
          children: (
            <>
              <h1>About</h1>
              <ul class="card-list">
                {docs.map((d) => (
                  <li key={d.slug} class="card">
                    <Link href={routes.about.show.href({ slug: d.slug })}>
                      {d.title}
                    </Link>
                    {d.summary ? <p>{d.summary}</p> : null}
                  </li>
                ))}
              </ul>
            </>
          ),
        });
      },
      show: async ({ params }) => {
        const d = await getDoc("about", params.slug ?? "");
        if (!d) return new Response("Not found", { status: 404 });
        return docPage(d, routes.about.index.href(), "About");
      },
    },
  });

  // Training — vocal / drama courses.
  app.map(routeGroup.training, {
    actions: {
      index: async () => {
        const docs = await listDocs("training");
        docs.sort((a, b) => a.title.localeCompare(b.title));
        return page({
          title: "Training — Théâtre Lapis",
          description:
            "Vocal and drama training courses offered by Théâtre Lapis.",
          children: (
            <>
              <h1>Training courses</h1>
              <ul class="card-list">
                {docs.map((d) => (
                  <li key={d.slug} class="card">
                    <Link href={routes.training.show.href({ slug: d.slug })}>
                      {d.title}
                    </Link>
                    {d.summary ? <p>{d.summary}</p> : null}
                  </li>
                ))}
              </ul>
            </>
          ),
        });
      },
      show: async ({ params }) => {
        const d = await getDoc("training", params.slug ?? "");
        if (!d) return new Response("Not found", { status: 404 });
        return docPage(d, routes.training.index.href(), "All courses");
      },
    },
  });

  // News — the blog.
  app.map(routeGroup.blog, {
    actions: {
      index: async () => {
        const docs = await listByDate("blog");
        return page({
          title: "News — Théâtre Lapis",
          description: "News and updates from Théâtre Lapis.",
          children: (
            <>
              <h1>News</h1>
              <ul class="post-list">
                {docs.map((d) => (
                  <li key={d.slug}>
                    <Link href={routes.blog.show.href({ slug: d.slug })}>
                      {d.title}
                    </Link>
                    {d.date ? <time datetime={d.date}>{d.date}</time> : null}
                    {d.summary ? <p>{d.summary}</p> : null}
                  </li>
                ))}
              </ul>
            </>
          ),
        });
      },
      show: async ({ params }) => {
        const d = await getDoc("blog", params.slug ?? "");
        if (!d) return new Response("Not found", { status: 404 });
        return docPage(d, routes.blog.index.href(), "All news");
      },
    },
  });
});
