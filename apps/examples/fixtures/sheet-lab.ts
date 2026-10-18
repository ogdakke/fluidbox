import { mountSite } from "../src/site";
import { tallScenes } from "@ogdakke/fluidbox-design/art-scenes";
import { artSrc, scenes as gallery, type Scene } from "../src/art";
import "./safari-chrome.css";
import "./sheet-lab.css";

mountSite("fixtures", { fixture: "Sheet lab · scroll-snap dismiss and info panel" });

/** Every setting lives in the URL so a result can be reported as a link. */
const settings = {
  dismiss: {
    label: "Dismiss distance",
    options: { "1": "Off the screen", "0.6": "60% of the screen", "0.4": "40%" },
  },
  panel: { label: "Info panel", options: { auto: "Fits its content", tall: "At least 55%" } },

  overscroll: {
    label: "Overscroll padding",
    options: {
      on: "On: anchored to the bottom, under the toolbar",
      off: "Off: a floating pane above the toolbar",
    },
  },
  backdrop: { label: "Backdrop", options: { opaque: "Opaque", blur: "Translucent + blur" } },
  debug: {
    label: "Debug colours",
    options: {
      off: "Off",
      on: "Pane red, pane shadow green, close button blue, backdrop magenta",
    },
  },
} as const;

type SettingKey = keyof typeof settings;
const params = new URLSearchParams(location.search);
const root = document.documentElement;
const current = {} as Record<SettingKey, string>;
for (const [key, setting] of Object.entries(settings) as [
  SettingKey,
  (typeof settings)[SettingKey],
][]) {
  const choices = Object.keys(setting.options);
  const value = params.get(key);
  current[key] = value && choices.includes(value) ? value : choices[0]!;
  root.dataset[`lab${key[0]!.toUpperCase()}${key.slice(1)}`] = current[key];
}

const form = document.querySelector<HTMLFormElement>("[data-lab-settings]")!;
for (const [key, setting] of Object.entries(settings) as [
  SettingKey,
  (typeof settings)[SettingKey],
][]) {
  const fieldset = document.createElement("fieldset");
  fieldset.className = "fb-cell lab-setting";
  fieldset.innerHTML = `<legend class="fb-label">${setting.label}</legend>`;
  for (const [value, label] of Object.entries(setting.options)) {
    const option = document.createElement("label");
    option.className = "lab-option";
    option.innerHTML = `<input type="radio" name="${key}" value="${value}" /> <span>${label}</span>`;
    option.querySelector("input")!.checked = current[key] === value;
    fieldset.append(option);
  }
  form.append(fieldset);
}
form.addEventListener("change", () => {
  location.search = new URLSearchParams(
    new FormData(form) as unknown as Record<string, string>,
  ).toString();
});

// Made-up camera details, stable per scene, so the panel has something to show.
const cameras = ["Fujifilm X-T5", "Leica Q3", "Sony A7C II", "Ricoh GR IIIx", "Nikon Zf"];
const lenses = ["23mm f/1.4", "28mm f/1.7", "40mm f/2.5", "35mm f/2", "50mm f/1.8"];
function details(scene: Scene) {
  const pick = <T>(list: T[]) => list[scene.seed % list.length]!;
  return {
    Camera: pick(cameras),
    Lens: pick(lenses),
    Exposure: `1/${[125, 250, 500, 60, 1000][scene.seed % 5]}s · f/${[2, 2.8, 4, 5.6, 8][scene.seed % 5]} · ISO ${[100, 200, 400, 800, 160][scene.seed % 5]}`,
    Size: `${scene.width} × ${scene.height}`,
    Taken: new Date(2026, scene.seed % 12, 1 + (scene.seed % 27)).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }),
    Place: ["Lofoten", "Dolomites", "Wadi Rum", "Hokkaido", "Patagonia"][scene.seed % 5]!,
  };
}

// Gallery.
// The shared gallery plus phone-screenshot shapes, to see tall photos scale and move.
const scenes = [...gallery, ...tallScenes];
const galleryGrid = document.querySelector<HTMLElement>("[data-lab-gallery]")!;
for (const [index, scene] of scenes.entries()) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "fb-cell lab-tile";
  button.setAttribute("aria-label", `Open ${scene.title}`);
  button.innerHTML = `<img src="${artSrc(scene)}" alt="" />`;
  button.addEventListener("click", () => open(index));
  galleryGrid.append(button);
}

// Overlay.
const overlay = document.createElement("div");
overlay.className = "sl-overlay";
overlay.hidden = true;
overlay.setAttribute("role", "dialog");
overlay.setAttribute("aria-modal", "true");
overlay.setAttribute("aria-label", "Photo viewer");
overlay.innerHTML = `
  <div class="sl-backdrop"></div>
  <div class="sl-container">
    <div class="sl-strip"></div>
    <button type="button" class="sl-close" aria-label="Close">×</button>
  </div>`;
document.body.append(overlay);
const container = overlay.querySelector<HTMLElement>(".sl-container")!;
const strip = overlay.querySelector<HTMLElement>(".sl-strip")!;
overlay.querySelector(".sl-close")!.addEventListener("click", () => dismiss("button"));

const sheets = scenes.map((scene, index) => {
  const slide = document.createElement("div");
  slide.className = "sl-slide";
  slide.setAttribute("role", "group");
  slide.setAttribute("aria-label", `${index + 1} of ${scenes.length}`);
  const meta = Object.entries(details(scene))
    .map(([term, value]) => `<div><dt>${term}</dt><dd>${value}</dd></div>`)
    .join("");
  slide.innerHTML = `
    <i class="sl-underlay" aria-hidden="true"></i>
    <div class="sl-sheet" tabindex="-1">
      <i class="sl-snap sl-snap--dismiss"></i>
      <i class="sl-snap sl-snap--photo"></i>
      <div class="sl-spacer"></div>
      <div class="sl-stage"><figure class="sl-figure"><img src="${artSrc(scene)}" alt="${scene.title}" draggable="false" /></figure></div>
      <div class="sl-panel-wrap"><section class="sl-panel" aria-label="Photo information">
        <span class="sl-grabber" aria-hidden="true"></span>
        <h2>${scene.title}</h2>
        <p>An illustrated landscape from the Fluidbox art set, ${scene.width > scene.height ? "landscape" : "portrait"} at ${scene.width} by ${scene.height}. The panel is plain page content in the sheet, so it scrolls, snaps and selects like text anywhere else.</p>
        <dl class="sl-meta">${meta}</dl>
      </section></div>
    </div>`;
  strip.append(slide);
  const sheet = slide.querySelector<HTMLElement>(".sl-sheet")!;
  sheet.addEventListener("scroll", () => onSheetScroll(sheet), { passive: true });
  sheet.addEventListener("scrollend", () => settleSheet(sheet));
  const photo = slide.querySelector<HTMLElement>(".sl-figure img")!;
  photo.addEventListener("load", () => overlay.hidden || measure());
  return { slide, sheet, photo, panel: slide.querySelector<HTMLElement>(".sl-panel-wrap")! };
});

// Like React Aria's sheet: close as soon as the photo is out of sight, during
// the momentum, rather than waiting for the scroll to land and settle. Each
// sheet is its own root; it reaches under the bars, so "out of sight" includes them.
let entered = false;
for (const { sheet, photo } of sheets) {
  new IntersectionObserver(
    ([entry]) => {
      if (!entry || overlay.hidden || sheet !== sheets[active]?.sheet) return;
      if (entry.intersectionRatio > 0) entered = true;
      else if (entered) close("scroll");
    },
    { root: sheet, threshold: [0] },
  ).observe(photo);
}

// How far the browser's bars can reach past the window, as in the package's zoom.
function chromeReach(): number {
  if (!matchMedia("(pointer: coarse)").matches) return 0;
  const long = Math.max(screen.width, screen.height);
  const short = Math.min(screen.width, screen.height);
  return Math.max(0, Math.ceil((innerWidth > innerHeight ? short : long) - innerHeight));
}

// Geometry: the window, the reach, the dismiss distance and each panel's
// visible height, as lengths CSS can use.
let dismissDistance = 0;
let reach = 0;
// React Aria's sheet has no sticky or fixed layer: its scroller sits absolute at
// the page's scroll position. Safari takes a sticky layer at the screen's edge
// for chrome and tints its bar with a colour from inside it, even one well
// clear of the edge.
function pin() {
  container.style.top = `${scrollY}px`;
}

function measure() {
  const height = innerHeight;
  reach = chromeReach();
  overlay.style.setProperty("--sl-h", `${height}px`);
  overlay.style.setProperty("--sl-r", `${reach}px`);
  // "Off the screen" travels the window and the reach below it, so a flick
  // carries the photo out of sight and the observer closes mid-momentum.
  dismissDistance =
    current.dismiss === "1" ? height + reach : Math.round(height * Number(current.dismiss));
  overlay.style.setProperty("--sl-d", `${dismissDistance}px`);
  for (const { slide, panel, photo } of sheets) {
    // The wrapper's height less the part under the toolbar: the anchored panel
    // pads itself under it, the floating pane leaves a gap of backdrop there.
    const panelHeight = panel.offsetHeight - reach;
    // On the slide, so the underlay behind the sheet reads it too.
    slide.style.setProperty("--sl-p", `${panelHeight}px`);
    // The panel rises through the empty space under the photo first, then
    // pushes the photo up with it, a gap ahead of it. The stage holds still for
    // that first stretch. A photo with less room below than the gap moves a
    // little faster than the scroll instead, over the whole push. The anchored
    // panel overlaps a tall enough photo instead, its rounded top over the
    // photo's bottom edge; the floating pane keeps clear of it.
    const gap = current.overscroll === "on" ? -24 : 12;
    const hold = Math.min(height - (photo.offsetTop + photo.offsetHeight) - gap, panelHeight);
    slide.style.setProperty("--sl-hold", `${hold}px`);
    slide.style.setProperty("--sl-hold-range", `${hold >= 1 ? hold : panelHeight}px`);
  }
}
// Only a change to the window moves the resting points. Page layout changes,
// like the readout growing a line, must not snap a sheet back mid-scroll.
let windowSize = "";
addEventListener("resize", () => {
  const size = `${innerWidth}x${innerHeight}`;
  if (overlay.hidden || size === windowSize) return;
  windowSize = size;
  pin();
  const mode = infoMode;
  measure();
  for (const { sheet } of sheets) sheet.scrollTop = restingTop(sheet, mode);
});

const infoTop = (sheet: HTMLElement) => sheet.scrollHeight - sheet.clientHeight;
const restingTop = (sheet: HTMLElement, info: boolean) => (info ? infoTop(sheet) : dismissDistance);

// State.
let active = 0;
let infoMode = false;
let touching = 0;
let lastEvent = "none";
overlay.addEventListener("touchstart", (event) => (touching = event.touches.length), {
  passive: true,
});
overlay.addEventListener("touchend", (event) => (touching = event.touches.length), {
  passive: true,
});
overlay.addEventListener("touchcancel", (event) => (touching = event.touches.length), {
  passive: true,
});

const settleTimers = new WeakMap<HTMLElement, number>();
function onSheetScroll(sheet: HTMLElement) {
  // A fallback for engines without scrollend: settle once scrolling pauses.
  clearTimeout(settleTimers.get(sheet));
  settleTimers.set(
    sheet,
    window.setTimeout(() => settleSheet(sheet), 140),
  );
  scheduleReadout();
}

function settleSheet(sheet: HTMLElement) {
  clearTimeout(settleTimers.get(sheet));
  // The jump to the dismissed point ends a scroll too; only the scroll-in counts.
  if (
    overlay.dataset.state === "opening" &&
    sheet === sheets[active]?.sheet &&
    sheet.scrollTop > 2
  ) {
    overlay.dataset.state = "open";
  }
  if (overlay.dataset.state !== "open" || sheet !== sheets[active]?.sheet) return;
  if (touching > 0) return;
  const top = sheet.scrollTop;
  // Shorter dismiss distances leave the photo in sight, so the observer never fires.
  if (top <= 2) {
    close("scroll", true);
    return;
  }
  if (Math.abs(top - infoTop(sheet)) <= 2) infoMode = true;
  else if (Math.abs(top - dismissDistance) <= 2) infoMode = false;
  else return;
  lastEvent = `settled ${infoMode ? "info" : "photo"}`;
  // Every other photo rests where this one did, so swiping sideways keeps the panel.
  for (const other of sheets) {
    if (other.sheet !== sheet) other.sheet.scrollTop = restingTop(other.sheet, infoMode);
  }
  scheduleReadout();
}

function setActive(index: number) {
  active = index;
  for (const [i, { slide }] of sheets.entries()) {
    slide.toggleAttribute("data-active", i === index);
    slide.setAttribute("aria-hidden", String(i !== index));
  }
}

let stripTimer = 0;
const settleStrip = () => {
  clearTimeout(stripTimer);
  const index = Math.round(strip.scrollLeft / strip.clientWidth);
  if (index !== active && sheets[index]) {
    setActive(index);
    lastEvent = `selected ${index + 1}`;
  }
  scheduleReadout();
};
strip.addEventListener(
  "scroll",
  () => {
    clearTimeout(stripTimer);
    stripTimer = window.setTimeout(settleStrip, 140);
  },
  { passive: true },
);
strip.addEventListener("scrollend", settleStrip);

let returnFocus: HTMLElement | null = null;
function open(index: number) {
  returnFocus = document.activeElement as HTMLElement | null;
  overlay.style.height = `${Math.max(root.scrollHeight, innerHeight)}px`;
  overlay.hidden = false;
  overlay.dataset.state = "opening";
  infoMode = false;
  entered = false;
  windowSize = `${innerWidth}x${innerHeight}`;
  pin();
  measure();
  setActive(index);
  strip.scrollTo({ left: index * strip.clientWidth, behavior: "instant" });
  for (const { sheet } of sheets) sheet.scrollTop = dismissDistance;
  // Open the way a dismiss closes, in reverse: start at the dismissed point and
  // let the browser scroll the photo up into place. The jump and the smooth
  // scroll go in separate frames, or the browser can stay at the jump.
  const sheet = sheets[index]!.sheet;
  sheet.scrollTop = 0;
  lastEvent = "opened";
  requestAnimationFrame(() => {
    sheet.scrollTo({ top: dismissDistance, behavior: "smooth" });
    // In case the scroll-in never reports its end.
    window.setTimeout(() => {
      if (overlay.dataset.state === "opening") overlay.dataset.state = "open";
    }, 1000);
    sheet.focus({ preventScroll: true });
    scheduleReadout();
  });
}

/** Scrolls the photo away; the observer closes once it is out of sight. */
let closeTimer = 0;
function dismiss(reason: string) {
  if (overlay.dataset.state !== "open") return;
  lastEvent = `dismissing by ${reason}`;
  sheets[active]!.sheet.scrollTo({ top: 0, behavior: "smooth" });
  // In case the smooth scroll is interrupted or never reaches the end.
  clearTimeout(closeTimer);
  closeTimer = window.setTimeout(() => close(reason, true), 900);
}

function close(reason: string, fade = false) {
  if (overlay.dataset.state !== "open") return;
  clearTimeout(closeTimer);
  lastEvent = `closed by ${reason}`;
  const finish = () => {
    overlay.hidden = true;
    delete overlay.dataset.state;
    returnFocus?.focus({ preventScroll: true });
    scheduleReadout();
  };
  // The photo is already out of sight when the observer closes, so there is
  // nothing to fade. Only a close that lands with it in view fades.
  if (!fade) return finish();
  overlay.dataset.state = "closing";
  window.setTimeout(finish, 120);
}

document.addEventListener("keydown", (event) => {
  if (overlay.hidden || overlay.dataset.state !== "open") return;
  const sheet = sheets[active]!.sheet;
  if (event.key === "Escape") dismiss("keyboard");
  else if (event.key === "i" || event.key === "I") {
    sheet.scrollTo({ top: restingTop(sheet, !infoMode), behavior: "smooth" });
  } else if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
    event.preventDefault();
    strip.scrollBy({
      left: (event.key === "ArrowRight" ? 1 : -1) * strip.clientWidth,
      behavior: "smooth",
    });
  }
});

// Readout.
function lvhMinusSvh() {
  const probe = document.createElement("div");
  probe.style.cssText = "position:absolute;visibility:hidden;height:calc(100lvh - 100svh)";
  document.body.append(probe);
  const value = probe.offsetHeight;
  probe.remove();
  return value;
}
const readout = document.querySelector<HTMLElement>("[data-lab-readout]")!;
function updateReadout() {
  const sheet = sheets[active]?.sheet;
  readout.textContent = [
    `url        ${location.pathname}${location.search}`,
    `gap        ${sheet ? Math.round(parseFloat(getComputedStyle(sheet.querySelector(".sl-panel-wrap")!).paddingBottom) - reach) : "-"}px  lvh-svh ${Math.round(lvhMinusSvh())}px`,
    `settings   ${Object.entries(current)
      .map(([key, value]) => `${key}=${value}`)
      .join(" ")}`,
    `state      ${overlay.hidden ? "closed" : overlay.dataset.state}  photo ${active + 1}  ${infoMode ? "info" : "photo"}  last: ${lastEvent}`,
    `sheet      top ${sheet ? Math.round(sheet.scrollTop) : "-"}  dismiss ${dismissDistance}  info ${sheet ? infoTop(sheet) : "-"}  reach ${reach}  screen ${screen.width} x ${screen.height}`,
    `inner      ${innerWidth} x ${innerHeight}  dpr ${devicePixelRatio}`,
    `supports   scroll-timeline ${CSS.supports("animation-timeline: scroll()") ? "yes" : "no"}  timeline-scope ${CSS.supports("timeline-scope: --a") ? "yes" : "no"}  scrollend ${"onscrollend" in window ? "yes" : "no"}`,
    `ua         ${navigator.userAgent}`,
  ].join("\n");
}
let frame = 0;
function scheduleReadout() {
  cancelAnimationFrame(frame);
  frame = requestAnimationFrame(updateReadout);
}
updateReadout();
