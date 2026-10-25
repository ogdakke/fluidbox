/**
 * A 3D model slide drawn by Google's `<model-viewer>`, which this add-on
 * doesn't bundle: load it yourself, or pass `load`. Safe to import on the
 * server.
 */
import { addStyles, paintPoster, posterStyles } from "./addon-styles";
import type {
  FluidboxCustomItemBase,
  FluidboxSlideRenderer,
  FluidboxThumbnail,
} from "./public-api";

/** A glTF or GLB model. Its fields are `<model-viewer>`'s, by property name. */
export interface FluidboxModelItem extends FluidboxCustomItemBase<"model"> {
  readonly id: string;
  /** The `.glb` or `.gltf` file. */
  readonly src: string;
  /** An image of the model, shown over the thumbnail until the model is ready. */
  readonly poster?: string;
  /** Offer augmented reality where the device has it. */
  readonly ar?: boolean;
  /** `ar-modes`, such as `"webxr scene-viewer quick-look"`. */
  readonly arModes?: string;
  /** `ios-src`: a USDZ file for AR Quick Look on iOS. */
  readonly iosSrc?: string;
  /** More `<model-viewer>` attributes, such as `{ "camera-orbit": "45deg 75deg 2m" }`. */
  readonly attributes?: Readonly<Record<string, string>>;
}

declare module "@ogdakke/fluidbox" {
  interface FluidboxItemTypes {
    model: FluidboxModelItem;
  }
}

/** What `modelItem` takes. */
export interface FluidboxModelItemOptions extends Omit<
  FluidboxModelItem,
  "type" | "id" | "thumbnail"
> {
  /** Defaults to `src`. */
  readonly id?: string;
  readonly thumbnail?: FluidboxThumbnail;
}

/**
 * A model item for the model slide. Its box fills the stage unless you
 * pass `fit: "contain"`; `width` and `height` then only shape the poster.
 */
export function modelItem(options: FluidboxModelItemOptions): FluidboxModelItem {
  return {
    fit: "fill",
    ...options,
    type: "model",
    id: options.id ?? options.src,
  };
}

/** What `createModelSlide` takes. */
export interface FluidboxModelSlideOptions {
  /**
   * Load `<model-viewer>`, as `() => import("@google/model-viewer")`. The
   * slide calls it when a model is first opened or comes on show, then waits
   * for the element to be defined. Without it, load the element yourself.
   */
  readonly load?: () => Promise<unknown>;
}

/** The model element's API the renderer uses; `<model-viewer>` has more. */
interface ModelViewerElement extends HTMLElement {
  pause?(): void;
  readonly loaded?: boolean;
  cameraOrbit?: string;
  cameraTarget?: string;
  fieldOfView?: string;
  getCameraOrbit?(): { toString(): string };
  getCameraTarget?(): { toString(): string };
  getFieldOfView?(): number;
  getMaximumFieldOfView?(): number;
  getIdealAspect?(): number;
  jumpCameraToGoal?(): void;
  toDataURL?(type?: string, quality?: number): string;
}

/** Where a model's camera is: `<model-viewer>`'s camera properties. */
interface ModelView {
  readonly orbit: string;
  readonly target: string;
  /** Null while the camera isn't zoomed, so the element keeps its own field of view. */
  readonly fieldOfView: string | null;
}

const RADIANS = Math.PI / 180;

/** A loaded model's camera, or null. */
function readView(model: ModelViewerElement): ModelView | null {
  if (!model.loaded || !model.getCameraOrbit || !model.getCameraTarget || !model.getFieldOfView) {
    return null;
  }
  const shown = model.getFieldOfView();
  // A zoom narrows the field of view below the widest the element allows.
  const widest = model.getMaximumFieldOfView?.() ?? shown;
  const zoomed = Math.abs(widest - shown) > 0.01;
  // <model-viewer> widens the vertical field of view of a box narrower than
  // the model; the property takes it unwidened, so another box widens it for
  // its own shape.
  const aspect = model.clientWidth / model.clientHeight;
  const widen = Math.max(1, (model.getIdealAspect?.() ?? 0) / (aspect || 1));
  const fieldOfView = (2 * Math.atan(Math.tan((shown * RADIANS) / 2) / widen)) / RADIANS;
  return {
    orbit: model.getCameraOrbit().toString(),
    target: model.getCameraTarget().toString(),
    fieldOfView: zoomed ? `${fieldOfView}deg` : null,
  };
}

/** The field of view a page gave each live model, before a close set one. */
const ownFieldOfView = new WeakMap<ModelViewerElement, string>();

/** Turn a model's camera to `view` at once, without its eased move. */
function applyView(model: ModelViewerElement, view: ModelView) {
  model.cameraOrbit = view.orbit;
  model.cameraTarget = view.target;
  if (!ownFieldOfView.has(model)) ownFieldOfView.set(model, model.fieldOfView ?? "auto");
  // Unzoomed, the element goes back to its own field of view, "auto" unless
  // the page set one, so it keeps fitting the model to its box.
  model.fieldOfView = view.fieldOfView ?? ownFieldOfView.get(model)!;
  model.jumpCameraToGoal?.();
}

/** A picture of what a loaded model draws now, or null. */
function snapshot(model: ModelViewerElement) {
  if (!model.loaded || !model.toDataURL) return null;
  try {
    return model.toDataURL();
  } catch {
    return null;
  }
}

/** Whether `model` shows `src`. */
function showsSrc(model: Element, src: string) {
  const own = model.getAttribute("src");
  if (!own) return false;
  try {
    return new URL(own, model.baseURI).href === new URL(src, model.baseURI).href;
  } catch {
    return own === src;
  }
}

const modelStyles = `
:where([data-fluidbox-model] > model-viewer) {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  touch-action: none;
}
:where([data-fluidbox-model]:not([data-fluidbox-model-ready]) > model-viewer) {
  opacity: 0;
}
:where([data-fluidbox-model][data-fluidbox-model-ready] > [data-fluidbox-media-poster]) {
  visibility: hidden;
}
/* A close carries the poster, or a snapshot of the model's view, home as a photo, and leaves the live model behind:
   in a flight, or in the slide's own frame, where a box holding the element closes. */
:where([data-fluidbox-flight], [data-fluidbox-status="closing"])
  :where([data-fluidbox-model])
  > [data-fluidbox-media-poster] {
  visibility: visible;
}
:where([data-fluidbox-flight], [data-fluidbox-status="closing"])
  :where([data-fluidbox-model])
  > model-viewer {
  visibility: hidden;
}
`;

/**
 * Make the slide for model items. The slide shows the thumbnail, then the
 * poster. Each time the slide comes on show it makes a `<model-viewer>`,
 * loading the element the first time, and shows the model once it has loaded;
 * an opening waits for its first frame. When the slide leaves the show the
 * element goes and the poster returns: `<model-viewer>` draws nothing, or a
 * clipped frame, once it has left the page and come back, as a closed
 * viewer's slides do. The model owns its input: a drag on it turns it, a pinch
 * zooms it, and the arrow keys turn it while it has focus, rather than moving
 * the viewer.
 *
 * A trigger can hold a live `<model-viewer>` of the item as its picture. The
 * opening then starts on its view: the flight shows a snapshot of it until the
 * slide's model has drawn with the trigger's camera (orbit, target and zoom).
 * A close turns the live model it lands on to the slide's view, and flies a
 * snapshot of that view.
 */
export function createModelSlide(
  options: FluidboxModelSlideOptions = {},
): FluidboxSlideRenderer<FluidboxModelItem> {
  let loading: Promise<unknown> | undefined;
  return (slide) => {
    const { item, media: target, signal, onActiveChange, waitUntil } = slide;
    const ownerDocument = target.ownerDocument;
    addStyles(ownerDocument, "model", posterStyles + modelStyles);
    const box = ownerDocument.createElement("div");
    box.dataset.fluidboxMediaAddon = "";
    box.dataset.fluidboxModel = "";
    paintPoster(box, item.thumbnail, item.poster, signal);
    target.append(box);
    // A picture of a live model's view, over the posters: the trigger's as an
    // opening flies, before the slide's own model has drawn; the slide's as a
    // close carries it home.
    const paintSnapshot = (src: string | null) => {
      if (!src) return;
      let image = box.querySelector<HTMLImageElement>('[data-fluidbox-media-poster="snapshot"]');
      if (!image) {
        image = ownerDocument.createElement("img");
        image.alt = "";
        image.setAttribute("aria-hidden", "true");
        image.draggable = false;
        image.decoding = "sync";
        image.dataset.fluidboxMediaPoster = "snapshot";
      }
      image.src = src;
      box.insertBefore(image, model?.parentNode === box ? model : null);
    };
    // The trigger's live model showing this item, whose view an opening starts from.
    const card = () => {
      const origin = slide.origin?.model as ModelViewerElement | undefined;
      return origin && showsSrc(origin, item.src) ? origin : undefined;
    };
    let model: ModelViewerElement | undefined;
    let shown: Promise<void> | undefined;
    // Each show counts, so one the slide has left stops making its element.
    let shows = 0;
    const show = async (run: number, synced: boolean) => {
      const registry = ownerDocument.defaultView?.customElements;
      if (!registry) return;
      if (options.load && !registry.get("model-viewer")) {
        loading ??= options.load().catch((error: unknown) => {
          // A failed load tries again on the next model.
          loading = undefined;
          throw error;
        });
        await loading;
      }
      await registry.whenDefined("model-viewer");
      if (signal.aborted || run !== shows) return;
      const element = ownerDocument.createElement("model-viewer") as ModelViewerElement;
      model = element;
      // Content that owns its input: the viewer neither swipes, dismisses,
      // zooms nor steps from a gesture or a key that starts on the model.
      model.dataset.fluidboxOwnsInput = "";
      model.setAttribute("camera-controls", "");
      model.setAttribute("touch-action", "none");
      model.setAttribute("alt", item.title);
      if (item.ar) model.setAttribute("ar", "");
      if (item.arModes) model.setAttribute("ar-modes", item.arModes);
      if (item.iosSrc) model.setAttribute("ios-src", item.iosSrc);
      for (const [name, value] of Object.entries(item.attributes ?? {})) {
        model.setAttribute(name, value);
      }
      // An opening from a live model starts on its view: the first frame
      // draws with the trigger's camera.
      const sync = () => {
        const view = synced && card() && readView(card()!);
        if (view) applyView(element, view);
      };
      sync();
      // Its first frame: the load event, then a frame painted with it.
      const loaded = new Promise<void>((resolve, reject) => {
        element.addEventListener(
          "load",
          () => {
            if (model !== element) return resolve();
            // The trigger may have turned while the model loaded.
            sync();
            box.dataset.fluidboxModelReady = "";
            ownerDocument.defaultView!.requestAnimationFrame(() => resolve());
          },
          { once: true, signal },
        );
        element.addEventListener("error", () => reject(new Error(`${item.src} didn't load`)), {
          once: true,
          signal,
        });
      });
      element.addEventListener(
        "error",
        () => {
          if (model === element) box.dataset.fluidboxModelError = "";
        },
        { signal },
      );
      model.setAttribute("src", item.src);
      box.append(model);
      await loaded;
    };
    const start = () => {
      if (shown) return shown;
      const run = ++shows;
      const synced = slide.opening;
      // Until the model draws, the opening flies on the trigger's view.
      if (synced && card()) paintSnapshot(snapshot(card()!));
      return (shown = show(run, synced).catch(() => {
        if (run !== shows) return;
        // A failed load of the element tries again when the slide next comes on show.
        if (!model) shown = undefined;
        box.dataset.fluidboxModelError = "";
      }));
    };
    const hide = () => {
      shows += 1;
      shown = undefined;
      model?.pause?.();
      model?.remove();
      model = undefined;
      delete box.dataset.fluidboxModelReady;
      delete box.dataset.fluidboxModelError;
    };
    // A close carries the model's view home, and turns the live model it
    // lands on, if it shows this item, to that view.
    slide.onClose((landing) => {
      if (!model) return;
      paintSnapshot(snapshot(model));
      const view = readView(model);
      const home = landing?.model as ModelViewerElement | undefined;
      if (view && home && showsSrc(home, item.src)) applyView(home, view);
    });
    // The model being opened, or opened again, starts now and holds the flight
    // for its first frame; neighbouring slides keep their posters until they
    // come on show.
    if (slide.opening) waitUntil(start());
    else if (slide.active) void start();
    return onActiveChange((now) => {
      if (!now) hide();
      else if (slide.opening) waitUntil(start());
      else void start();
    });
  };
}
