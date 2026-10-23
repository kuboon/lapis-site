/**
 * Spotlight marquee for the home page.
 *
 * A light source sweeps across the `.marquee` stage. The title's extruded
 * depth and its cast shadow fall away from the light, the letter faces glow
 * where the light hits them, and the lettering tilts slightly towards it.
 *
 * - Mouse (fine pointer): the light follows the cursor.
 * - Touch / no pointer: the light drifts slowly over time and shifts with
 *   scrolling.
 * - prefers-reduced-motion: no time drift; the light still follows the cursor
 *   or the scroll position.
 *
 * Without this script the CSS defaults render a static lit title.
 */

const stage = document.querySelector(".marquee");
const title = stage?.querySelector(".marquee-title");
const depth = stage?.querySelector(".marquee-depth");
const face = stage?.querySelector(".marquee-face");

if (stage && title && depth && face) start();

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
    const tBox = title.getBoundingClientRect();
    const fBox = face.getBoundingClientRect();
    const cx = tBox.left - box.left + tBox.width / 2;
    const cy = tBox.top - box.top + tBox.height / 2;

    // Shadows fall away from the light, longer the further away it is.
    const dx = cx - light.x;
    const dy = cy - light.y;
    const dist = Math.hypot(dx, dy) || 1;
    const ux = dx / dist;
    const uy = dy / dist;
    const reach = Math.min(dist / (Math.hypot(box.width, box.height) / 2), 1.4);
    const size = parseFloat(getComputedStyle(face).fontSize);

    depth.style.textShadow = shadows(ux, uy, size, reach);

    // Spotlight pool on the stage, highlight on the letter faces.
    stage.style.setProperty("--lx", `${light.x.toFixed(1)}px`);
    stage.style.setProperty("--ly", `${light.y.toFixed(1)}px`);
    face.style.setProperty(
      "--fx",
      `${(light.x + box.left - fBox.left).toFixed(1)}px`,
    );
    face.style.setProperty(
      "--fy",
      `${(light.y + box.top - fBox.top).toFixed(1)}px`,
    );

    // Lean the lettering slightly towards the light.
    const rx = clamp((light.y - cy) / box.height, -1, 1) * -9;
    const ry = clamp((light.x - cx) / box.width, -1, 1) * 12;
    title.style.setProperty("--rx", `${rx.toFixed(2)}deg`);
    title.style.setProperty("--ry", `${ry.toFixed(2)}deg`);
  }

  wake();
}

/** Builds the extrusion + cast-shadow `text-shadow` list. */
function shadows(ux, uy, size, reach) {
  const parts = [];
  const steps = 14;
  const extrude = size * (0.035 + 0.05 * reach);
  for (let i = 1; i <= steps; i++) {
    const s = (i / steps) * extrude;
    const lightness = (26 - (i / steps) * 18).toFixed(1);
    parts.push(
      `${px(ux * s)} ${px(uy * s)} 0 hsl(32 28% ${lightness}%)`,
    );
  }
  const cast = size * (0.12 + 0.4 * reach);
  parts.push(
    `${px(ux * cast)} ${px(uy * cast)} ${
      px(size * (0.06 + 0.1 * reach))
    } rgb(0 0 0 / 0.7)`,
    `${px(ux * cast * 1.9)} ${px(uy * cast * 1.9)} ${
      px(size * (0.2 + 0.3 * reach))
    } rgb(0 0 0 / 0.45)`,
  );
  return parts.join(", ");
}

function px(n) {
  return `${n.toFixed(2)}px`;
}

function clamp(n, lo, hi) {
  return Math.min(Math.max(n, lo), hi);
}
