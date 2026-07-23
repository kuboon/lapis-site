# WordPress → Markdown migration

This folder documents the one-off migration of **theatrelapis.org** off
WordPress and into the Markdown content the site now renders from
(`pages/content/`).

## What was migrated

The source was a WordPress WXR export (`Tools → Export → All content`). From it:

- **63 pages/posts** were converted to Markdown with frontmatter, under
  `pages/content/<category>/<slug>.md`.
- Category and the *Works by year* grouping were reconstructed from the site's
  WordPress **navigation menu**, so the structure mirrors the original site:

  | Category   | Folder                    | Count |
  | ---------- | ------------------------- | ----- |
  | Works      | `pages/content/works/`    | 37    |
  | Training   | `pages/content/training/` | 12    |
  | Pages      | `pages/content/pages/`    | 8     |
  | About      | `pages/content/about/`    | 4     |
  | News/Blog  | `pages/content/blog/`     | 2     |

- **15 year-index pages** (`2012`…`2026`) were *not* migrated as files — they
  were just lists of links, now regenerated automatically by the `/works` route
  which groups productions by their `year` frontmatter.

### Frontmatter

Each file carries:

```yaml
title: "..."          # page title
slug: ...             # original WordPress slug (also the route segment)
category: works       # works | about | training | news | post | reviews | …
year: 2018            # productions only, drives the /works grouping
date: "2018-03-06"    # original publish date
original_url: "..."   # the page's old WordPress URL
wp_id: 951            # original WordPress post id
```

## What was dropped

Three items were **SEO spam injected into WordPress** (a link-farm post, a
"Write for us sponsored posts" solicitation, and an empty `test` post) —
`wp_id` 1803, 1805, 1423. They are excluded by `DROP_IDS` in the importer.

## Images — now local

The WXR export referenced image URLs but did not contain the image files, so
migrated content originally pointed at the live WordPress host. Ahead of that
server being shut down, every referenced media file (587 images/PDFs) was
downloaded into [`pages/static/media/`](../pages/static/media) and all
`<img>`/asset references were rewritten to local `/static/media/…` paths. No
content or import file references the old host any more.

## Files in this folder

| File                       | What it is                                        |
| -------------------------- | ------------------------------------------------- |
| `wxr-to-markdown.py`       | The reproducible importer (see below).            |
| `SITEMAP.md`               | Old URL → new route/file map for every page.      |
| `pages.json`               | The new-route map as JSON.                        |

## Re-running the import

The importer is deterministic — it regenerates the content folders from a fresh
export:

```sh
pip install markdownify beautifulsoup4
python3 import/wxr-to-markdown.py path/to/theatrelapis.WordPress.xml
```
