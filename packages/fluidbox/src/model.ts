/**
 * A 3D model slide drawn by Google's `<model-viewer>`, which this add-on
 * doesn't bundle: load it yourself, or pass `load`. Safe to import on the
 * server.
 */
import { addStyles, paintPoster, posterStyles } from "./addon-styles";
import type {
  FluidboxCustomItemBase,
  FluidboxItem,
  FluidboxSlideRenderer,
  FluidboxThumbnail,
} from "./public-api";

/** A glTF or GLB model. Its fields are `<model-viewer>`'s, by property name. */
export interface FluidboxModelItem extends FluidboxCustomItemBase<"model"> {
  readonly id: string;
  /** The marker `modelItem` sets, so the renderer knows its items. */
  readonly model: true;
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
  "type" | "id" | "model" | "thumbnail"
> {
  /** Defaults to `src`. */
  readonly id?: string;
  readonly thumbnail?: FluidboxThumbnail;
}

/**
 * A model item for the model renderer. Its box fills the stage unless you
 * pass `fit: "contain"`; `width` and `height` then only shape the poster.
 */
export function modelItem(options: FluidboxModelItemOptions): FluidboxModelItem {
  return {
    fit: "fill",
    ...options,
    type: "model",
    id: options.id ?? options.src,
    model: true,
  };
}

/** Whether an item is a model made by `modelItem`. */
export function isModelItem(item: FluidboxItem): item is FluidboxModelItem {
  return item.type === "model";
}

/** What `createModelRenderer` takes. */
export interface FluidboxModelRendererOptions {
  /**
   * Load `<model-viewer>`, as `() => import("@google/model-viewer")`. The
   * renderer calls it when a model slide first comes on show, then waits for
   * the element to be defined. Without it, load the element yourself.
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
/* A closing flight carries the poster home, as a photo, and leaves the live model behind. */
:where([data-fluidbox-flight] [data-fluidbox-model]) > [data-fluidbox-media-poster] {
  visibility: visible;
}
:where([data-fluidbox-flight] [data-fluidbox-model]) > model-viewer {
  visibility: hidden;
}
`;

/**
 * Make a renderer for `modelItem` models. The slide shows the thumbnail, then
 * the poster, through the opening flight. When the slide first comes on show
 * it loads `<model-viewer>` and the model, and shows the model once it has
 * loaded. The model owns its input: a drag on it turns it, a pinch zooms it,
 * and the arrow keys turn it while it has focus, rather than moving the viewer.
 */
export function createModelRenderer(
  options: FluidboxModelRendererOptions = {},
): FluidboxSlideRenderer<FluidboxItem> {
  let loading: Promise<unknown> | undefined;
  return ({ item, media: target, signal, active, onActiveChange }) => {
    if (!isModelItem(item)) {
      throw new TypeError(`The model renderer draws modelItem models: ${item.id}`);
    }
    const ownerDocument = target.ownerDocument;
    addStyles(ownerDocument, "model", posterStyles + modelStyles);
    const box = ownerDocument.createElement("div");
    box.dataset.fluidboxMediaAddon = "";
    box.dataset.fluidboxModel = "";
    paintPoster(box, item.thumbnail, item.poster, signal);
    target.append(box);
    let model: ModelViewerElement | undefined;
    const show = async () => {
      if (model) return;
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
      if (signal.aborted || model) return;
      model = ownerDocument.createElement("model-viewer") as ModelViewerElement;
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
      model.addEventListener("load", () => (box.dataset.fluidboxModelReady = ""), {
        once: true,
        signal,
      });
      model.addEventListener("error", () => (box.dataset.fluidboxModelError = ""), { signal });
      model.setAttribute("src", item.src);
      box.append(model);
    };
    const start = () => void show().catch(() => (box.dataset.fluidboxModelError = ""));
    // Neighbouring slides keep their posters: a model loads once its slide is on show.
    if (active) start();
    return onActiveChange((now) => {
      if (now) start();
      else model?.pause?.();
    });
  };
}
