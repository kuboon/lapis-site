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
import type { Handle } from "remix/ui";
import { Link } from "./link.tsx";
import { lapisLogo } from "./lapis-logo.ts";

/** Directory of static files served under `/static/*` (favicon, CSS, images, …). */
const STATIC_DIR = fromFileUrl(new URL("../static/", import.meta.url));

/** Prefixes a root-relative content path (e.g. `/static/media/…`) with the
 * deploy base path. */
function media(path: string): string {
  return path.startsWith("/") ? base + path : path;
}

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

/** Renders one Markdown document inside the page shell. A production with an
 * image opens on a full-bleed hero of it. */
async function docPage(d: Doc, backHref: string, backLabel: string) {
  const body = await renderMarkdown(stripLeadingH1(d.body));
  const hero = d.category === "works" && d.image;
  const heading = (
    <>
      <Link class="more" href={backHref}>← {backLabel}</Link>
      {d.year ? <p class="eyebrow">{d.year}</p> : null}
      <h1 class="display">{d.title}</h1>
    </>
  );
  return page({
    title: `${d.title} — Théâtre Lapis`,
    description: d.summary,
    children: (
      <article class="doc">
        {hero
          ? (
            <header class="doc-hero bleed">
              <img src={media(d.image)} alt="" />
              <div class="wrap doc-hero-text">{heading}</div>
            </header>
          )
          : <header class="doc-head">{heading}</header>}
        <div class="doc-body">{body}</div>
        <p class="doc-back">
          <Link class="more" href={backHref}>← {backLabel}</Link>
        </p>
      </article>
    ),
  });
}

/** A big, ruled list of links to documents (About, Training). */
function RowList(handle: Handle<{ docs: Doc[] }>) {
  return () => (
    <ul class="row-list">
      {handle.props.docs.map((d) => (
        <li key={d.slug}>
          <Link href={docHref(d)}>
            <span class="row-title">{d.title}</span>
            <span class="row-note">→</span>
          </Link>
          {d.summary ? <p>{d.summary}</p> : null}
        </li>
      ))}
    </ul>
  );
}

export const router = createRouter();

router.mount(base || "/", (app: RouteBuilder) => {
  // Home + standalone info pages + static files.
  app.map(routeGroup, {
    actions: {
      home: async () => {
        const works = (await worksByYear()).flatMap(([, docs]) => docs);
        const onStage = works.filter((d) => d.image).slice(0, 3);
        return page({
          title: "Théâtre Lapis",
          description:
            "Théâtre Lapis — theatre company led by artistic director Yojiro Ichikawa, bridging musical, physical and straight theatre across cultures.",
          scripts: [routes.static.href({ path: "spotlight.js" })],
          children: (
            <>
              <section class="marquee bleed">
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
                <p class="eyebrow">London · New York · Tokyo — since 2012</p>
                <p class="display hero-title">Theatre without borders</p>
                <div class="hero-row">
                  <div>
                    <p class="lead">
                      A theatre company led by artistic director{" "}
                      <Link
                        href={routes.about.show.href({
                          slug: "artistic-director",
                        })}
                      >
                        Yojiro Ichikawa
                      </Link>, working across the UK, US and Japan to bridge
                      musical, physical and straight theatre — and the cultures
                      they come from.
                    </p>
                    <p class="lead lead-ja" lang="ja">
                      {
                        // One string: JSX would turn line breaks into spaces.
                        "市川洋二郎が芸術監督を務める劇団。イギリス・アメリカ・日本を拠点に、" +
                        "ミュージカル／フィジカルシアター／ストレートプレイ、そして東西の文化を" +
                        "つなぐ作品を制作しています。"
                      }
                    </p>
                  </div>
                  <Link class="button" href={routes.works.index.href()}>
                    Explore our works →
                  </Link>
                </div>
              </section>

              <section class="home-works">
                <div class="section-head">
                  <h2 class="display">On stage</h2>
                  <Link class="more" href={routes.works.index.href()}>
                    All productions →
                  </Link>
                </div>
                <ul class="poster-grid">
                  {onStage.map((d) => (
                    <li key={d.slug}>
                      <Link class="poster" href={docHref(d)}>
                        <img src={media(d.image)} alt="" loading="lazy" />
                        <span class="poster-text">
                          <span class="eyebrow">{d.year}</span>
                          <span class="poster-title">{d.title}</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>

              <section class="aim bleed">
                <div class="wrap">
                  <p class="eyebrow">Our aim</p>
                  <p class="aim-quote">
                    To introduce authentic and aesthetic artforms to Western
                    audiences — and a deeper perspective on Japan.
                  </p>
                  <ol class="timeline">
                    <li>
                      <span class="timeline-year">2012</span>
                      Premiered in New York with <em>Ordinary Days</em>.
                    </li>
                    <li>
                      <span class="timeline-year">2016</span>
                      <em>The Red Candle</em>{" "}
                      at the Brunel Museum, seen by Prince Edward, Earl of
                      Wessex.
                    </li>
                    <li>
                      <span class="timeline-year">2019</span>
                      <em>Letter from the Sea</em>{" "}
                      marks 100 years of Japan–Poland relations.
                    </li>
                    <li>
                      <span class="timeline-year">2023</span>
                      <em>Galaxy Train</em>{" "}
                      in London; “Those Stars” won the Stiles &amp; Drewe Best
                      New Song Prize.
                    </li>
                  </ol>
                </div>
              </section>

              <section class="feature">
                <img
                  src={media("/static/media/2014/06/YO-.monochrome.web_.jpg")}
                  alt="Portrait of Yojiro Ichikawa"
                  loading="lazy"
                />
                <div>
                  <p class="eyebrow">Artistic Director</p>
                  <h2 class="display">Yojiro Ichikawa</h2>
                  <p class="name-ja" lang="ja">市川洋二郎</p>
                  <p>
                    An award-winning director and translator working across the
                    UK, US and Japan — from the New National Theatre Tokyo to
                    the Drama League’s Directors Project in New York.
                  </p>
                  <Link
                    class="more"
                    href={routes.about.show.href({ slug: "artistic-director" })}
                  >
                    Read biography →
                  </Link>
                </div>
              </section>

              <section class="training-band bleed">
                <div class="wrap">
                  <div class="section-head">
                    <h2 class="display">Training</h2>
                    <span lang="ja">レッスン</span>
                  </div>
                  <ul class="row-list">
                    {[
                      ["vocal-training", "Vocal Training", "EN / JP"],
                      ["drama-training", "Drama Training", "EN / JP"],
                      ["monologue", "Monologue Lab", "EN / JP"],
                      ["masterlessons", "Master Lessons", "Style Gates"],
                    ].map(([slug, title, note]) => (
                      <li key={slug}>
                        <Link href={routes.training.show.href({ slug })}>
                          <span class="row-title">{title}</span>
                          <span class="row-note">{note} →</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
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
              <h1 class="display page-title">Site map</h1>
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
          scripts: [routes.static.href({ path: "works-filter.js" })],
          children: (
            <>
              <header class="page-head">
                <p class="eyebrow">
                  Works · <span lang="ja">公演記録</span>
                </p>
                <h1 class="display page-title">Works</h1>
                <div class="page-head-row">
                  <p class="lead">
                    Musicals, plays, readings and concerts, 2012 to now —
                    directed, adapted or translated by the company.
                  </p>
                  <div
                    class="filter"
                    role="group"
                    aria-label="Filter by period"
                    hidden
                  >
                    <button type="button" data-period="all" aria-pressed="true">
                      All
                    </button>
                    <button
                      type="button"
                      data-period="2020s"
                      aria-pressed="false"
                    >
                      2020s
                    </button>
                    <button
                      type="button"
                      data-period="2010s"
                      aria-pressed="false"
                    >
                      2010s
                    </button>
                  </div>
                </div>
              </header>
              {groups.map(([year, docs]) => (
                <section
                  key={year}
                  class="year-group"
                  data-decade={/^\d{4}$/.test(year)
                    ? `${year.slice(0, 3)}0s`
                    : ""}
                >
                  <h2 class="year">{year}</h2>
                  <ul class="work-grid">
                    {docs.map((d) => (
                      <li key={d.slug}>
                        <Link
                          class="work"
                          href={routes.works.show.href({ slug: d.slug })}
                        >
                          {d.image
                            ? <img src={media(d.image)} alt="" loading="lazy" />
                            : (
                              <span class="work-blank" aria-hidden="true">
                                {d.title}
                              </span>
                            )}
                          <span class="work-title">{d.title}</span>
                        </Link>
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
              <header class="page-head">
                <p class="eyebrow">
                  About · <span lang="ja">劇団について</span>
                </p>
                <h1 class="display page-title">Between East &amp; West</h1>
                <p class="lead">
                  Théâtre Lapis premiered on the New York stage in spring 2012
                  with the musical{" "}
                  <em>Ordinary Days</em>. We question traditional boundaries —
                  between musical and straight plays, between western and
                  eastern cultures — and seek other frontiers.
                </p>
              </header>
              <img
                class="wide-image bleed"
                src={media("/static/media/2026/03/Antigone-27-copy-scaled.jpg")}
                alt="The ensemble of Antigone at Clifftown Theatre"
              />
              <RowList docs={docs} />
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
              <header class="page-head">
                <p class="eyebrow">
                  Training · <span lang="ja">レッスン</span>
                </p>
                <h1 class="display page-title">Training</h1>
              </header>
              <RowList docs={docs} />
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
              <header class="page-head">
                <p class="eyebrow">News</p>
                <h1 class="display page-title">News</h1>
              </header>
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
