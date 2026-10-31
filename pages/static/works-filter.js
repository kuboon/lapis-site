/**
 * Period filter for the Works page.
 *
 * The filter buttons ship `hidden` so the page shows every production without
 * JavaScript; this reveals them and hides the year groups outside the chosen
 * decade (`data-decade` on each `.year-group`).
 */

const filter = document.querySelector(".filter");
const groups = [...document.querySelectorAll(".year-group")];

if (filter) {
  const buttons = [...filter.querySelectorAll("button[data-period]")];
  filter.hidden = false;

  filter.addEventListener("click", (e) => {
    const button = e.target.closest("button[data-period]");
    if (!button) return;
    const period = button.dataset.period;
    for (const b of buttons) {
      b.setAttribute("aria-pressed", String(b === button));
    }
    for (const g of groups) {
      g.hidden = period !== "all" && g.dataset.decade !== period;
    }
  });
}
