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

## Images ⚠️ still on WordPress

The WXR export references image URLs but does **not** contain the image files.
Every `<img>` and asset link still points at `https://theatrelapis.org/files/…`,
so pages render with live images **only while the WordPress site stays up**.

Before decommissioning WordPress, download the images and rewrite the links:

- `images-inline.txt` — 587 image/asset URLs referenced inside page content.
- `images-attachments.txt` — 477 media-library attachment URLs (the full library).

A follow-up step can fetch these into `pages/static/media/` and rewrite the
`https://theatrelapis.org/files/…` references to local `/static/media/…` paths.
(This environment can't reach the live site, so it wasn't done here.)

## Files in this folder

| File                       | What it is                                        |
| -------------------------- | ------------------------------------------------- |
| `wxr-to-markdown.py`       | The reproducible importer (see below).            |
| `SITEMAP.md`               | Old URL → new route/file map for every page.      |
| `pages.json`               | The same map as JSON.                             |
| `images-inline.txt`        | Image/asset URLs used inside content.             |
| `images-attachments.txt`   | Every WordPress media-library attachment URL.     |

## Re-running the import

The importer is deterministic — it regenerates the content folders from a fresh
export:

```sh
pip install markdownify beautifulsoup4
python3 import/wxr-to-markdown.py path/to/theatrelapis.WordPress.xml
```
