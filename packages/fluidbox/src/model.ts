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
/* A close carries the poster home, as a photo, and leaves the live model behind:
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
    let model: ModelViewerElement | undefined;
    let shown: Promise<void> | undefined;
    // Each show counts, so one the slide has left stops making its element.
    let shows = 0;
    const show = async (run: number) => {
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
      // Its first frame: the load event, then a frame painted with it.
      const loaded = new Promise<void>((resolve, reject) => {
        element.addEventListener(
          "load",
          () => {
            if (model !== element) return resolve();
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
      return (shown = show(run).catch(() => {
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
