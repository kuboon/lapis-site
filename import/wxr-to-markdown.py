#!/usr/bin/env python3
"""Convert a WordPress WXR export into the site's Markdown content.

Usage:
    pip install markdownify beautifulsoup4
    python3 import/wxr-to-markdown.py path/to/theatrelapis.WordPress.xml

Reads a WordPress eXtended RSS (WXR) export and writes:
  - pages/content/<category>/<slug>.md   — one Markdown file per page/post
  - import/pages.json                    — manifest (old URL → new path)
  - import/images-inline.txt             — image/asset URLs used inside content
  - import/images-attachments.txt        — every media-library attachment URL

Categories and the "Works by year" grouping are derived from the site's
WordPress navigation menu, so the output mirrors the original site structure.
This script is deterministic: re-running it regenerates the content folders
from scratch.
"""
import html
import json
import os
import re
import shutil
import sys
import xml.etree.ElementTree as ET
from collections import Counter
from urllib.parse import urlparse

from bs4 import BeautifulSoup
from markdownify import markdownify as md

NS = {
    "wp": "http://wordpress.org/export/1.2/",
    "content": "http://purl.org/rss/1.0/modules/content/",
    "excerpt": "http://wordpress.org/export/1.2/excerpt/",
}

# Top-level nav page id -> content category.
TOPCAT = {
    "114": "news", "2": "about", "166": "works",
    "418": "reviews", "884": "gallery", "76": "contact", "459": "training",
}
FOLDER = {"about": "about", "works": "works", "training": "training"}
# Hacked-in SEO spam / throwaway posts to drop.
DROP_IDS = {"1803", "1805", "1423"}

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
CONTENT = os.path.join(REPO, "pages", "content")

BLOCKS = ("table|thead|tfoot|caption|col|colgroup|tbody|tr|td|th|div|dl|dd|dt|"
          "ul|ol|li|pre|form|map|area|blockquote|address|math|style|p|h[1-6]|hr|"
          "fieldset|legend|section|article|aside|hgroup|header|footer|nav|figure|"
          "figcaption|details|menu|summary|iframe")
BLOCKSET = set("h1 h2 h3 h4 h5 h6 p div table ul ol figure blockquote hr".split())


def gx(it, path):
    e = it.find(path, NS)
    return e.text if e is not None and e.text else ""


def meta(it):
    return {gx(m, "wp:meta_key"): gx(m, "wp:meta_value")
            for m in it.findall("wp:postmeta", NS)}


def build_navmap(channel, pages):
    """Return (cat_by_pageid, year_by_pageid) derived from the nav menu."""
    items = {}
    for it in channel.findall("item"):
        if gx(it, "wp:post_type") != "nav_menu_item":
            continue
        m = meta(it)
        items[gx(it, "wp:post_id")] = {
            "order": int(gx(it, "wp:menu_order") or 0),
            "title": html.unescape((it.findtext("title") or "").strip()),
            "obj": m.get("_menu_item_object", ""),
            "objid": m.get("_menu_item_object_id", ""),
            "parent": m.get("_menu_item_menu_item_parent", "0"),
        }
    kids = {}
    for iid, v in items.items():
        kids.setdefault(v["parent"], []).append(iid)

    def label(iid):
        v = items[iid]
        return v["title"] or pages.get(v["objid"], {}).get("title", "")

    cat, year = {}, {}

    def assign(iid, category, curyear):
        v = items[iid]
        if v["obj"] == "page" and v["objid"]:
            cat[v["objid"]] = category
            if curyear:
                year[v["objid"]] = curyear
        for c in sorted(kids.get(iid, []), key=lambda x: items[x]["order"]):
            ny = curyear
            if category == "works" and label(c).strip().isdigit():
                ny = label(c).strip()
            assign(c, category, ny)

    for top in kids.get("0", []):
        assign(top, TOPCAT.get(items[top]["objid"], "other"), None)
    return cat, year


def wpautop(pee):
    pee = re.sub(r"\r\n?", "\n", pee)
    pee = re.sub(r"(<(?:" + BLOCKS + r")(?:\s[^>]*)?>)", r"\n\1", pee)
    pee = re.sub(r"(</(?:" + BLOCKS + r")>)", r"\1\n\n", pee)
    pee = re.sub(r"(<hr\s*/?>)", r"\n\1\n\n", pee)
    out = []
    for blk in re.split(r"\n\s*\n", pee):
        blk = blk.strip()
        if not blk:
            continue
        if re.match(r"</?(?:" + BLOCKS + r")[\s/>]", blk) or blk.startswith("<!--"):
            out.append(blk)
        else:
            out.append("<p>" + re.sub(r"\n", "<br>\n", blk) + "</p>")
    return "\n\n".join(out)


def clean_html(raw):
    raw = re.sub(r"<!--.*?-->", "", raw, flags=re.S)  # strip Gutenberg comments
    raw = wpautop(raw)
    soup = BeautifulSoup(raw, "html.parser")
    for tag in soup.find_all(["strong", "b", "em", "i"]):
        if tag.find(list(BLOCKSET)) is not None or not tag.get_text(strip=True):
            tag.unwrap()  # unwrap empty or block-wrapping emphasis (malformed source)
    return str(soup)


def make_converter(slug2path, imgset):
    def collect_and_rewrite(text):
        for m in re.findall(
                r"https?://[^\s\"')<>]+\.(?:jpg|jpeg|png|gif|webp|svg|mp4|pdf)",
                text, re.I):
            if "theatrelapis.org" in m.lower():
                imgset.add(m)

        def repl(m):
            url = m.group(0)
            low = url.lower()
            if any(x in low for x in ("/files/", "/wp-content/", "/wp-json/")) \
                    or re.search(r"\.(jpg|jpeg|png|gif|webp|svg|mp4|pdf)$", low):
                return url
            seg = urlparse(url).path.strip("/").split("/")[-1]
            return slug2path.get(seg, url)

        return re.sub(r"https?://(?:www\.)?theatrelapis\.org/[^\s\"')<>]*",
                      repl, text, flags=re.I)

    def balance_bold(line):
        if line.count("**") % 2 == 1:
            i = line.rfind("**")
            line = line[:i] + line[i + 2:]
        return line

    def fixlink(m):
        text, tgt = m.group(1), m.group(2).strip()
        if re.match(r"(?:https?:|mailto:|tel:|/|#)", tgt):
            return m.group(0)
        if tgt.startswith("//"):
            return "[%s](https:%s)" % (text, tgt)
        return "[%s](https://%s)" % (text, tgt.lstrip("./"))

    def to_md(raw):
        raw = collect_and_rewrite(raw)
        raw = clean_html(raw)
        out = md(raw, heading_style="ATX", bullets="-", strip=["span"])
        out = html.unescape(out)
        out = re.sub(r"(?m)^\s*\*\*\s*$", "", out)
        out = re.sub(r"\*\*(\s*)\*\*", r"\1", out)
        out = re.sub(r"(?m)^\s*\\?\*\*(#{1,6}\s)", r"\1", out)
        out = re.sub(r"(?m)^(#{1,6})\s+(.*)$",
                     lambda m: m.group(1) + " " + m.group(2).replace("**", "").strip(),
                     out)
        out = "\n".join(balance_bold(l) for l in out.split("\n"))
        out = re.sub(r"http://theatrelapis\.org", "https://theatrelapis.org",
                     out, flags=re.I)
        out = re.sub(r"(?<!\!)\[([^\]]*)\]\(([^)]+)\)", fixlink, out)
        out = re.sub(r"[ \t]+\n", "\n", out)
        out = re.sub(r"\n{3,}", "\n\n", out).strip()
        return out

    return to_md


def yaml_q(s):
    return '"%s"' % str(s).replace("\\", "\\\\").replace('"', '\\"')


def main(xml_path):
    channel = ET.parse(xml_path).getroot().find("channel")
    pages, posts, attach = {}, {}, {}
    for it in channel.findall("item"):
        d = dict(
            id=gx(it, "wp:post_id"), type=gx(it, "wp:post_type"),
            status=gx(it, "wp:status"),
            title=html.unescape((it.findtext("title") or "").strip()),
            slug=gx(it, "wp:post_name"), link=(it.findtext("link") or ""),
            content=gx(it, "content:encoded"), date=gx(it, "wp:post_date"),
            attach_url=gx(it, "wp:attachment_url"))
        if d["type"] == "attachment":
            attach[d["id"]] = d
        elif d["type"] == "page" and d["status"] == "publish":
            pages[d["id"]] = d
        elif d["type"] == "post" and d["status"] == "publish":
            posts[d["id"]] = d

    navcat, navyear = build_navmap(channel, pages)

    def is_year_index(p):
        return navcat.get(p["id"]) == "works" \
            and re.fullmatch(r"\d{4}", (p["title"] or "x").strip()) \
            and p["slug"].endswith("-2")

    records = []
    for p in pages.values():
        if is_year_index(p):
            records.append(dict(id=p["id"], title=p["title"], slug=p["slug"],
                                link=p["link"], date=p["date"], cat="year-index",
                                folder=None, year=(p["title"] or "").strip(),
                                newpath=None, content=p["content"]))
            continue
        if not p["content"].strip():
            continue
        c = navcat.get(p["id"], "other")
        folder = "blog" if c == "news" else FOLDER.get(c, "pages")
        slug = p["slug"] or ("page-%s" % p["id"])
        records.append(dict(id=p["id"], title=p["title"], slug=slug, link=p["link"],
                            date=p["date"], cat=c, folder=folder,
                            year=navyear.get(p["id"], ""),
                            newpath="/%s/%s" % (folder, slug), content=p["content"]))
    for p in posts.values():
        if p["id"] in DROP_IDS or not p["content"].strip():
            continue
        slug = p["slug"] or ("post-%s" % p["id"])
        records.append(dict(id=p["id"], title=p["title"], slug=slug, link=p["link"],
                            date=p["date"], cat="post", folder="blog", year="",
                            newpath="/blog/%s" % slug, content=p["content"]))

    slug2path = {r["slug"]: r["newpath"] for r in records if r["newpath"]}
    imgset = set()
    to_md = make_converter(slug2path, imgset)

    for sub in ("about", "works", "training", "pages", "blog"):
        shutil.rmtree(os.path.join(CONTENT, sub), ignore_errors=True)

    for r in records:
        if r["folder"] is None:
            continue
        d = os.path.join(CONTENT, r["folder"])
        os.makedirs(d, exist_ok=True)
        fm = ["---", "title: %s" % yaml_q(r["title"]), "slug: %s" % r["slug"],
              "category: %s" % r["cat"]]
        if r["year"]:
            fm.append("year: %s" % r["year"])
        if r["date"]:
            fm.append("date: %s" % yaml_q(r["date"][:10]))
        fm += ["original_url: %s" % yaml_q(r["link"]), "wp_id: %s" % r["id"], "---"]
        with open(os.path.join(d, r["slug"] + ".md"), "w") as f:
            f.write("\n".join(fm) + "\n\n" + to_md(r["content"]) + "\n")

    att = sorted({a["attach_url"] for a in attach.values() if a["attach_url"]})
    inline = sorted({re.sub(r"http://theatrelapis\.org", "https://theatrelapis.org",
                            u, flags=re.I) for u in imgset})
    with open(os.path.join(HERE, "images-inline.txt"), "w") as f:
        f.write("\n".join(inline) + "\n")
    with open(os.path.join(HERE, "images-attachments.txt"), "w") as f:
        f.write("\n".join(att) + "\n")
    manifest = [dict(wp_id=r["id"], title=r["title"], category=r["cat"],
                     year=r["year"], original_url=r["link"], new_path=r["newpath"],
                     file=(None if r["folder"] is None
                           else "pages/content/%s/%s.md" % (r["folder"], r["slug"])))
                for r in sorted(records, key=lambda x: (x["cat"], str(x["year"]),
                                                        x["title"]))]
    with open(os.path.join(HERE, "pages.json"), "w") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)

    written = sum(1 for r in records if r["folder"])
    print("Markdown files written:", written)
    print("by folder:", dict(Counter(r["folder"] for r in records if r["folder"])))
    print("inline images:", len(inline), " attachments:", len(att))
    print("year-index pages recorded (not written):",
          sum(1 for r in records if r["folder"] is None))


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit("usage: python3 import/wxr-to-markdown.py <export.xml>")
    main(sys.argv[1])
