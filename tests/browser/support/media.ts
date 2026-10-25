import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "@playwright/test";

const still = readFileSync(
  join(import.meta.dirname, "../../../apps/examples/public/products/fjord-room.webp"),
);

/**
 * A stand-in for `<model-viewer>`: a focusable element that turns on a drag
 * and the arrow keys, zooms on a wheel, and fires `load` once it has a `src`.
 * As the real one, its focus target is a `.userInput` in its shadow root, and
 * it has the camera API a model slide syncs with: the orbit is the drag's
 * turn in degrees (`"<turn>deg 75deg 2m"`), the field of view 30° over the
 * zoom, and `toDataURL` a picture naming the orbit. It records what it got in
 * data attributes (`data-camera-orbit`, `data-camera-target`,
 * `data-field-of-view`, `data-jumps`, `data-snapshots`), and how often it has
 * joined the page: the real element draws nothing, or a clipped frame, once it
 * has left the page and come back. \`window.__modelViewerDelay\` sets how long
 * its load takes, 50 ms by default.
 */
const fakeModelViewer = `
window.__modelViewerLoads = (window.__modelViewerLoads ?? 0) + 1;
class FakeModelViewer extends HTMLElement {
  constructor() {
    super();
    this.orbit = 0;
    this.zoom = 1;
    this.target = "0m 0m 0m";
    this.ownFieldOfView = "auto";
    // \`window.__modelViewerNoInput\` stands in for a version whose focus target is named otherwise.
    this.attachShadow({ mode: "open", delegatesFocus: true }).innerHTML =
      '<div class="' + (window.__modelViewerNoInput ? "input" : "userInput") +
      '" tabindex="0" role="img" aria-label="3D model" style="width:100%;height:100%"></div>';
    let x = null;
    this.addEventListener("pointerdown", (event) => {
      x = event.clientX;
      this.setPointerCapture(event.pointerId);
    });
    this.addEventListener("pointermove", (event) => {
      if (x === null) return;
      this.orbit += event.clientX - x;
      x = event.clientX;
      this.dataset.orbit = String(Math.round(this.orbit));
    });
    this.addEventListener("click", () => {
      this.dataset.clicks = String(Number(this.dataset.clicks ?? 0) + 1);
    });
    const up = () => (x = null);
    this.addEventListener("pointerup", up);
    this.addEventListener("pointercancel", up);
    this.addEventListener("keydown", (event) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      this.orbit += event.key === "ArrowRight" ? 10 : -10;
      this.dataset.orbit = String(Math.round(this.orbit));
    });
    this.addEventListener(
      "wheel",
      (event) => {
        event.preventDefault();
        this.zoom *= Math.exp(-event.deltaY * 0.01);
        this.dataset.zoom = this.zoom.toFixed(2);
      },
      { passive: false },
    );
  }
  get updateComplete() {
    return Promise.resolve(true);
  }
  connectedCallback() {
    this.dataset.connections = String(Number(this.dataset.connections ?? 0) + 1);
    this.style.display = "block";
    if (this.getAttribute("src") && !this.loading) {
      this.loading = true;
      setTimeout(() => {
        this.loaded = true;
        // The view its first frame draws.
        this.dataset.orbitAtLoad = String(Math.round(this.orbit));
        this.dispatchEvent(new Event("load"));
      }, window.__modelViewerDelay ?? 50);
    }
  }
  set cameraOrbit(value) {
    this.orbit = Number.parseFloat(value) || 0;
    this.dataset.cameraOrbit = value;
    this.dataset.orbit = String(Math.round(this.orbit));
  }
  get cameraOrbit() {
    return this.dataset.cameraOrbit ?? "auto auto auto";
  }
  set cameraTarget(value) {
    this.target = value;
    this.dataset.cameraTarget = value;
  }
  get cameraTarget() {
    return this.dataset.cameraTarget ?? "auto auto auto";
  }
  set fieldOfView(value) {
    this.ownFieldOfView = value;
    this.zoom = value === "auto" ? 1 : 30 / Number.parseFloat(value);
    this.dataset.fieldOfView = value;
    this.dataset.zoom = this.zoom.toFixed(2);
  }
  get fieldOfView() {
    return this.ownFieldOfView;
  }
  getCameraOrbit() {
    const orbit = Math.round(this.orbit) + "deg 75deg 2m";
    return { toString: () => orbit };
  }
  getCameraTarget() {
    const target = this.target;
    return { toString: () => target };
  }
  getFieldOfView() {
    return 30 / this.zoom;
  }
  getMaximumFieldOfView() {
    return 30;
  }
  getIdealAspect() {
    return 0;
  }
  jumpCameraToGoal() {
    this.dataset.jumps = String(Number(this.dataset.jumps ?? 0) + 1);
  }
  toDataURL() {
    // \`window.__modelViewerTainted\` stands in for a canvas that drew from another origin.
    if (window.__modelViewerTainted) throw new DOMException("The canvas is tainted.", "SecurityError");
    this.dataset.snapshots = String(Number(this.dataset.snapshots ?? 0) + 1);
    const orbit = Math.round(this.orbit);
    return "data:image/svg+xml," + encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" data-orbit="' + orbit + '"><rect width="80" height="80" fill="teal"/></svg>',
    ) + "#orbit=" + orbit;
  }
  pause() {
    this.dataset.paused = String(Number(this.dataset.paused ?? 0) + 1);
  }
}
customElements.define("model-viewer", FakeModelViewer);
`;

/** A player page that keeps every message its parent posts. */
const player = `<!doctype html><title>Player</title><script>
window.messages = [];
addEventListener("message", (event) => messages.push({ data: event.data, origin: event.origin }));
</script><p>Player</p>`;

/**
 * Serve the media add-ons' outside resources from the test: YouTube's and
 * Vimeo's players, YouTube's stills, and `<model-viewer>` from its CDN.
 * Returns the URLs each was asked for.
 */
export async function stubMedia(page: Page) {
  const requests = { players: [] as string[], stills: [] as string[], modelViewer: [] as string[] };
  await page.route("https://www.youtube-nocookie.com/**", (route) => {
    requests.players.push(route.request().url());
    return route.fulfill({ contentType: "text/html", body: player });
  });
  await page.route("https://player.vimeo.com/**", (route) => {
    requests.players.push(route.request().url());
    return route.fulfill({ contentType: "text/html", body: player });
  });
  await page.route("https://i.ytimg.com/**", (route) => {
    requests.stills.push(route.request().url());
    return route.fulfill({ contentType: "image/webp", body: still });
  });
  await page.route("https://ajax.googleapis.com/**", (route) => {
    requests.modelViewer.push(route.request().url());
    return route.fulfill({
      contentType: "text/javascript",
      headers: { "access-control-allow-origin": "*" },
      body: fakeModelViewer,
    });
  });
  return requests;
}

/** The messages a player page got from the slide, by the start of its URL. */
export function playerMessages(page: Page, prefix: string) {
  const frame = page.frames().find((each) => each.url().startsWith(prefix));
  return frame ? frame.evaluate(() => (window as unknown as { messages: unknown[] }).messages) : [];
}
