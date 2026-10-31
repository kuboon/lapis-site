import { renderToString } from "remix/ui/server";
import { createHtmlResponse } from "remix/response/html";
import type { Handle, RemixNode } from "remix/ui";
import { routes } from "./routes.ts";
import { Link } from "./link.tsx";
import { lapisLogo } from "./lapis-logo.ts";

interface DocumentProps {
  title: string;
  description?: string;
  /** Load the client bundle to hydrate islands on this page. */
  hydrate?: boolean;
  /** Extra classic-enhancement module scripts (URLs) to load on this page. */
  scripts?: string[];
  children: RemixNode;
}

/** The Théâtre Lapis logo, drawn in the current text colour. */
export function LogoMark(handle: Handle<{ class?: string }>) {
  return () => (
    <svg
      class={handle.props.class}
      viewBox={lapisLogo.viewBox}
      role="img"
      aria-label="Théâtre Lapis"
    >
      <path
        transform={lapisLogo.transform}
        d={lapisLogo.d}
        fill="currentColor"
      />
    </svg>
  );
}

/** The primary navigation, shared by every page. */
function Nav() {
  return () => (
    <nav class="site-nav" aria-label="Primary">
      <Link href={routes.works.index.href()}>Works</Link>
      <Link href={routes.about.index.href()}>About</Link>
      <Link href={routes.training.index.href()}>Training</Link>
      <Link href={routes.blog.index.href()}>News</Link>
      <Link href={routes.page.href({ slug: "reviews" })}>Reviews</Link>
      <Link href={routes.page.href({ slug: "gallery" })}>Gallery</Link>
      <Link href={routes.page.href({ slug: "contact-us" })}>Contact</Link>
      <Link class="nav-tickets" href={routes.page.href({ slug: "tickets-2" })}>
        Tickets
      </Link>
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
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link
            rel="preconnect"
            href="https://fonts.gstatic.com"
            crossorigin="anonymous"
          />
          <link
            rel="stylesheet"
            href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,400..900&family=Zen+Kaku+Gothic+New:wght@500;700&display=swap"
          />
          <link
            rel="stylesheet"
            href={routes.static.href({ path: "styles.css" })}
          />
        </head>
        <body>
          <header class="site-header">
            <div class="wrap site-header-inner">
              <Link class="brand" href={routes.home.href()}>
                <LogoMark class="brand-logo" />
              </Link>
              <Nav />
            </div>
          </header>
          <main class="site-main wrap">{children}</main>
          <footer class="site-footer">
            <div class="wrap">
              <LogoMark class="footer-logo" />
              <div class="footer-contacts">
                <p>
                  <span class="label">General inquiry</span>
                  <a href="mailto:info@theatrelapis.org">
                    info@theatrelapis.org
                  </a>
                </p>
                <p>
                  <span class="label">Tickets</span>
                  <a href="mailto:tickets@theatrelapis.org">
                    tickets@theatrelapis.org
                  </a>
                </p>
                <p>
                  <span class="label">Based in</span>
                  London · New York · Tokyo
                </p>
              </div>
              <p class="footer-base">
                <span>© Théâtre Lapis</span>
                <Link href={routes.sitemap.href()}>Site map</Link>
              </p>
            </div>
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
