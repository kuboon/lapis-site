/**
 * Spotlight marquee for the home page.
 *
 * A light source sweeps across the `.marquee` stage. The logo's extruded
 * depth and its cast shadow fall away from the light, the letter faces glow
 * where the light hits them, and the logo tilts slightly towards it.
 *
 * - Mouse (fine pointer): the light follows the cursor.
 * - Touch / no pointer: the light drifts slowly over time and shifts with
 *   scrolling.
 * - prefers-reduced-motion: no time drift; the light still follows the cursor
 *   or the scroll position.
 *
 * Without this script the CSS defaults render a static lit logo.
 */

const stage = document.querySelector(".marquee");
const title = stage?.querySelector(".marquee-title");
const logo = stage?.querySelector(".marquee-logo");
const lit = logo?.querySelector("#marquee-lit");

if (stage && title && logo && lit) start();

function start() {
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const finePointer = matchMedia("(hover: hover) and (pointer: fine)");

  /** Cursor position in viewport coords, or null when not following it. */
  let pointer = null;
  /** Smoothed light position in stage coords (px). */
  let light = null;
  let last = performance.now();
  let raf = 0;
  let visible = true;

  globalThis.addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse" || !finePointer.matches) return;
    pointer = { x: e.clientX, y: e.clientY };
    wake();
  }, { passive: true });
  document.documentElement.addEventListener("pointerleave", () => {
    pointer = null;
    wake();
  });
  globalThis.addEventListener("scroll", wake, { passive: true });
  globalThis.addEventListener("resize", wake, { passive: true });

  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    wake();
  }).observe(stage);
  document.addEventListener("visibilitychange", wake);

  function wake() {
    if (!raf && visible && !document.hidden) {
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }
  }

  function frame(now) {
    raf = 0;
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;

    const box = stage.getBoundingClientRect();
    const target = pointer
      ? { x: pointer.x - box.left, y: pointer.y - box.top }
      : drift(now / 1000, box);

    if (!light) light = { ...target };
    // Ease towards the target; quicker when tracking the cursor.
    const k = 1 - Math.exp(-dt * (pointer ? 9 : 2.5));
    light.x += (target.x - light.x) * k;
    light.y += (target.y - light.y) * k;

    render(box);

    const settled = Math.abs(target.x - light.x) < 0.5 &&
      Math.abs(target.y - light.y) < 0.5;
    // Keep animating while drifting over time or still easing.
    const drifting = !pointer && !reduceMotion.matches;
    if ((drifting || !settled) && visible && !document.hidden) wake();
  }

  /** Autonomous light path: slow Lissajous sweep, pushed down by scrolling. */
  function drift(t, box) {
    const scroll = Math.min(Math.max(-box.top / box.height, 0), 1);
    const moving = reduceMotion.matches ? 0 : 1;
    const x = 0.5 +
      moving * 0.34 * Math.sin(t * 0.21) +
      0.18 * Math.sin(scroll * Math.PI);
    const y = 0.22 +
      moving * 0.1 * Math.sin(t * 0.33 + 1.3) +
      0.7 * scroll;
    return { x: x * box.width, y: y * box.height };
  }

  function render(box) {
    const lBox = logo.getBoundingClientRect();
    const cx = lBox.left - box.left + lBox.width / 2;
    const cy = lBox.top - box.top + lBox.height / 2;

    // Shadows fall away from the light, longer the further away it is.
    const dx = cx - light.x;
    const dy = cy - light.y;
    const dist = Math.hypot(dx, dy) || 1;
    const reach = Math.min(dist / (Math.hypot(box.width, box.height) / 2), 1.4);
    logo.style.filter = shadows(dx / dist, dy / dist, logo.clientWidth, reach);

    // Spotlight pool on the stage.
    stage.style.setProperty("--lx", `${light.x.toFixed(1)}px`);
    stage.style.setProperty("--ly", `${light.y.toFixed(1)}px`);

    // Highlight on the letter faces: centre the gradient on the light, in the
    // logo's own (viewBox) coordinates.
    const vb = logo.viewBox.baseVal;
    const gx = vb.x + (light.x + box.left - lBox.left) / lBox.width * vb.width;
    const gy = vb.y + (light.y + box.top - lBox.top) / lBox.height * vb.height;
    lit.setAttribute("cx", gx.toFixed(0));
    lit.setAttribute("cy", gy.toFixed(0));

    // Lean the logo slightly towards the light.
    const rx = clamp((light.y - cy) / box.height, -1, 1) * -9;
    const ry = clamp((light.x - cx) / box.width, -1, 1) * 12;
    title.style.setProperty("--rx", `${rx.toFixed(2)}deg`);
    title.style.setProperty("--ry", `${ry.toFixed(2)}deg`);
  }

  wake();
}

/**
 * Builds the extrusion + cast-shadow `filter`. Chained drop-shadows each copy
 * everything before them one step further away, so N small steps sweep the
 * logo into a solid extrusion that darkens with depth.
 */
function shadows(ux, uy, width, reach) {
  const parts = [];
  const steps = 10;
  const step = width * (0.006 + 0.008 * reach) / steps;
  for (let i = 1; i <= steps; i++) {
    const lightness = (26 - (i / steps) * 18).toFixed(1);
    parts.push(
      `drop-shadow(${px(ux * step)} ${
        px(uy * step)
      } 0 hsl(32 28% ${lightness}%))`,
    );
  }
  const cast = width * (0.02 + 0.06 * reach);
  parts.push(
    `drop-shadow(${px(ux * cast)} ${px(uy * cast)} ${
      px(width * (0.008 + 0.014 * reach))
    } rgb(0 0 0 / 0.75))`,
  );
  return parts.join(" ");
}

function px(n) {
  return `${n.toFixed(2)}px`;
}

function clamp(n, lo, hi) {
  return Math.min(Math.max(n, lo), hi);
}
