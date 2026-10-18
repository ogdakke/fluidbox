import { mountSite } from "../src/site";
import { arraySource, createFluidbox } from "@ogdakke/fluidbox";
import type {
  FluidboxGalleryElement,
  FluidboxController,
  FluidboxItem,
  FluidboxOrigin,
  FluidboxStatus,
  FluidboxTarget,
} from "@ogdakke/fluidbox";
import { artItem, artSrc, scenes } from "../src/art";
import "./safari-chrome.css";

mountSite("fixtures", {
  fixture: "Safari chrome lab · which layers make iOS 26 Safari tint its bars",
});

/** Every setting lives in the URL so a result can be reported as a link. */
const settings = {
  backdrop: {
    label: "Backdrop colour",
    options: { opaque: "Opaque (default)", translucent: "Translucent" },
  },
  blur: { label: "Backdrop blur", options: { off: "Off (default)", on: "On" } },
  header: {
    label: "Page header",
    options: { none: "None", sticky: "Sticky", fixed: "Fixed" },
  },
  filmstrip: { label: "Filmstrip", options: { off: "Off", on: "On (fluidbox-gallery)" } },
  fit: { label: "viewport-fit", options: { auto: "auto", cover: "cover" } },
  probe: { label: "Probe colour", options: { solid: "Solid", translucent: "Translucent" } },
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

// Settings form: radios that reload the page with the new query.
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
  const next = new URLSearchParams(new FormData(form) as unknown as Record<string, string>);
  location.search = next.toString();
});

if (current.header !== "none") {
  const header = document.createElement("div");
  header.className = "lab-site-header";
  header.textContent = `${current.header} header`;
  document.body.prepend(header);
}

const pageHeight = () =>
  Math.max(root.scrollHeight, document.body.scrollHeight, window.innerHeight);

// Scroll lock for the "absolute at scrollY" probe.
let locks = 0;
function lockScroll(lock: boolean) {
  locks = Math.max(0, locks + (lock ? 1 : -1));
  root.classList.toggle("lab-scroll-locked", locks > 0);
}

// Probes: the same magenta layer built four ways.
type Probe = { id: string; title: string; note: string; build: () => HTMLElement; lock?: boolean };
const pageLayer = () => {
  const layer = document.createElement("div");
  layer.className = "lab-probe-page";
  layer.style.height = `${pageHeight()}px`;
  return layer;
};
const probes: Probe[] = [
  {
    id: "fixed",
    title: "Fixed",
    note: "position: fixed; inset: 0. The layer Devon reports as clipped and tinting.",
    build: () => {
      const layer = document.createElement("div");
      layer.className = "lab-probe-fill lab-probe-fill--fixed";
      return layer;
    },
  },
  {
    id: "absolute",
    title: "Absolute, page height",
    note: "Devon's backdrop: position: absolute over the whole page.",
    build: () => {
      const layer = pageLayer();
      layer.classList.add("lab-probe-fill");
      return layer;
    },
  },
  {
    id: "sticky",
    title: "Absolute + sticky child",
    note: "Our current lightbox: transparent page layer, viewport-sized sticky child painted.",
    build: () => {
      const layer = pageLayer();
      const child = document.createElement("div");
      child.className = "lab-probe-fill lab-probe-fill--sticky";
      layer.append(child);
      return layer;
    },
  },
  {
    id: "scroll-y",
    title: "Absolute at scrollY",
    note: "React Aria's Sheet: absolute child at the scroll offset, page scroll locked.",
    lock: true,
    build: () => {
      const layer = pageLayer();
      const child = document.createElement("div");
      child.className = "lab-probe-fill lab-probe-fill--scroll-y";
      child.style.top = `${window.scrollY}px`;
      layer.append(child);
      return layer;
    },
  },
];

const probeGrid = document.querySelector<HTMLElement>("[data-lab-probes]")!;
for (const probe of probes) {
  const cell = document.createElement("button");
  cell.type = "button";
  cell.className = "fb-cell lab-probe";
  cell.innerHTML = `<h3>${probe.title}</h3><p>${probe.note}</p>`;
  cell.addEventListener("click", () => {
    const layer = probe.build();
    layer.dataset.labProbeLayer = probe.id;
    const label = document.createElement("p");
    label.className = "lab-probe-label";
    label.textContent = `${probe.title} · tap to remove`;
    (layer.firstElementChild ?? layer).append(label);
    if (probe.lock) lockScroll(true);
    layer.addEventListener("click", () => {
      layer.remove();
      if (probe.lock) lockScroll(false);
    });
    document.body.append(layer);
    updateReadout();
  });
  probeGrid.append(cell);
}

// Gallery: every scene twice, so the page is long enough to collapse the toolbar.
const items: FluidboxItem[] = [...scenes, ...scenes].map((scene, index) =>
  artItem(scene, `lab-${index}-${scene.id}`),
);
const gallery = document.querySelector<HTMLElement>("[data-lab-gallery]")!;
const triggers = new Map<string, HTMLButtonElement>();
for (const [index, item] of items.entries()) {
  const scene = [...scenes, ...scenes][index]!;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "fb-cell lab-tile";
  button.setAttribute("aria-label", `Open ${scene.title}`);
  button.innerHTML = `<img data-fluidbox-origin src="${artSrc(scene)}" alt="" />`;
  gallery.append(button);
  triggers.set(item.id, button);
}

let status: FluidboxStatus = "closed";
const origin = (id: string): FluidboxOrigin | null => {
  const trigger = triggers.get(id);
  if (!trigger) return null;
  const thumbnail = trigger.querySelector("img")!;
  return { trigger, visual: thumbnail, thumbnail };
};
function onStatus(next: FluidboxStatus) {
  if (next === status) return;
  status = next;
  updateReadout();
}
function connect(controller: FluidboxController, open: (target: FluidboxTarget) => unknown) {
  for (const [id, trigger] of triggers) trigger.addEventListener("click", () => void open({ id }));
  window.safariChromeLab = controller;
}

if (current.filmstrip === "on") {
  // The filmstrip is a gallery element feature. The gallery wraps the grid so
  // its hidden <fluidbox-filmstrip> marker never counts as a grid cell.
  void import("@ogdakke/fluidbox/elements").then(async () => {
    const element = document.createElement("fluidbox-gallery") as FluidboxGalleryElement;
    element.setAttribute("aria-label", "Lab gallery");
    gallery.replaceWith(element);
    element.append(gallery, document.createElement("fluidbox-filmstrip"));
    element.source = arraySource(items);
    element.origins = { getOrigin: origin };
    const controller = await element.whenReady();
    controller.subscribe((state) => onStatus(state.status));
    connect(controller, (target) => element.open(target));
  });
} else {
  const controller = createFluidbox({
    source: arraySource(items),
    origins: { getOrigin: origin },
    onEvent(event) {
      if (event.type === "status-change") onStatus(event.status);
    },
  });
  connect(controller, (target) => controller.open(target, { reason: "trigger" }));
}

// Readout: viewport units, insets and what the page has on, as plain text to paste back.
const meter = document.createElement("div");
meter.className = "lab-meter";
meter.innerHTML = ["svh", "lvh", "dvh", "safe"]
  .map((unit) => `<i data-unit="${unit}"></i>`)
  .join("");
document.body.append(meter);
const readout = document.querySelector<HTMLElement>("[data-lab-readout]")!;
function updateReadout() {
  const unit = (name: string) => meter.querySelector<HTMLElement>(`[data-unit="${name}"]`)!;
  const safe = getComputedStyle(unit("safe"));
  const viewport = window.visualViewport;
  readout.textContent = [
    `url        ${location.pathname}${location.search}`,
    `settings   ${Object.entries(current)
      .map(([key, value]) => `${key}=${value}`)
      .join(" ")}`,
    `probes     ${[...document.querySelectorAll<HTMLElement>("[data-lab-probe-layer]")].map((probe) => probe.dataset.labProbeLayer).join(", ") || "none"}`,
    `lightbox   ${status}`,
    `inner      ${window.innerWidth} x ${window.innerHeight}  dpr ${window.devicePixelRatio}`,
    `visual     ${viewport ? `${Math.round(viewport.width)} x ${Math.round(viewport.height)} @ ${Math.round(viewport.offsetTop)}` : "n/a"}`,
    `units      svh ${unit("svh").offsetHeight}  lvh ${unit("lvh").offsetHeight}  dvh ${unit("dvh").offsetHeight}`,
    `safe area  top ${safe.paddingTop}  bottom ${safe.paddingBottom}`,
    `scroll     ${Math.round(window.scrollY)} of ${pageHeight()}`,
    `scroll-driven animations ${CSS.supports("animation-timeline: scroll()") ? "yes" : "no"}`,
    `ua         ${navigator.userAgent}`,
  ].join("\n");
}
let frame = 0;
const scheduleReadout = () => {
  cancelAnimationFrame(frame);
  frame = requestAnimationFrame(updateReadout);
};
window.addEventListener("resize", scheduleReadout);
window.addEventListener("scroll", scheduleReadout, { passive: true });
window.visualViewport?.addEventListener("resize", scheduleReadout);
updateReadout();

declare global {
  interface Window {
    safariChromeLab: FluidboxController;
  }
}
