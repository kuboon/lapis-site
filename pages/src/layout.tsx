import { renderToString } from "remix/ui/server";
import { createHtmlResponse } from "remix/response/html";
import type { Handle, RemixNode } from "remix/ui";
import { routes } from "./routes.ts";
import { Link } from "./link.tsx";

interface DocumentProps {
  title: string;
  description?: string;
  /** Load the client bundle to hydrate islands on this page. */
  hydrate?: boolean;
  /** Extra classic-enhancement module scripts (URLs) to load on this page. */
  scripts?: string[];
  children: RemixNode;
}

/** The primary navigation, shared by every page. */
function Nav() {
  return () => (
    <nav class="site-nav">
      <Link href={routes.works.index.href()}>Works</Link>
      <Link href={routes.about.index.href()}>About</Link>
      <Link href={routes.training.index.href()}>Training</Link>
      <Link href={routes.blog.index.href()}>News</Link>
      <Link href={routes.page.href({ slug: "reviews" })}>Reviews</Link>
      <Link href={routes.page.href({ slug: "gallery" })}>Gallery</Link>
      <Link href={routes.page.href({ slug: "contact-us" })}>Contact</Link>
    </nav>
  );
}

/** The full HTML document shell shared by every page. */
function Document(handle: Handle<DocumentProps>) {
  return () => {
    const { title, description, hydrate, scripts, children } = handle.props;
    return (
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>{title}</title>
          {description
            ? <meta name="description" content={description} />
            : null}
          <link rel="icon" href={routes.static.href({ path: "favicon.svg" })} />
          <link
            rel="stylesheet"
            href={routes.static.href({ path: "styles.css" })}
          />
        </head>
        <body>
          <header class="site-header">
            <Link class="brand" href={routes.home.href()}>
              Théâtre&nbsp;Lapis
            </Link>
            <Nav />
          </header>
          <main class="site-main">{children}</main>
          <footer class="site-footer">
            <p>
              © Théâtre Lapis ·{" "}
              <Link href={routes.sitemap.href()}>Site map</Link>
            </p>
          </footer>
          {hydrate
            ? (
              <script
                type="module"
                src={routes.static.href({ path: "client.js" })}
              >
              </script>
            )
            : null}
          {scripts?.map((src) => (
            <script key={src} type="module" src={src}></script>
          ))}
        </body>
      </html>
    );
  };
}

/**
 * Renders a page node inside the {@link Document} shell to a complete HTML
 * `Response`. Route actions call this to return a page.
 */
export async function page(
  props: Omit<DocumentProps, "children"> & { children: RemixNode },
): Promise<Response> {
  const html = "<!DOCTYPE html>" +
    (await renderToString(<Document {...props} />));
  return createHtmlResponse(html);
}
