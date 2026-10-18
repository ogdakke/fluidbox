import { controlIcon } from "./control-icons";
import { arraySource } from "./array-source";
import { createFluidbox } from "./create-fluidbox";
import { FilmstripSession } from "./filmstrip";
import { FluidboxItemElement, type DeclarativeFluidboxDefinition } from "./item";
import type {
  FluidboxController,
  FluidboxDispose,
  FluidboxOriginAdapter,
  FluidboxRenderer,
  FluidboxSource,
  FluidboxState,
  FluidboxTarget,
} from "./public-api";

const SOURCE_ATTRIBUTES = new Set([
  "item-id",
  "slot",
  "src",
  "srcset",
  "sizes",
  "media",
  "type",
  "width",
  "height",
  "alt",
  "title",
  "poster",
  "placeholder-src",
  "aria-label",
]);

function button(ownerDocument: Document, part: "close" | "previous" | "next", label: string) {
  const element = ownerDocument.createElement("button");
  element.type = "button";
  element.dataset[`fluidbox${part[0]!.toUpperCase()}${part.slice(1)}`] = "";
  element.setAttribute("aria-label", label);
  element.append(controlIcon(ownerDocument, part));
  return element;
}

/** Declarative custom-element adapter over one createFluidbox controller. */
export class FluidboxGalleryElement extends HTMLElement {
  #controller: FluidboxController | null = null;
  #source: FluidboxSource | null = null;
  #sourceSnapshot: FluidboxSource = arraySource([]);
  #origins: FluidboxOriginAdapter | undefined;
  #definitions = new Map<string, DeclarativeFluidboxDefinition>();
  #renderers: Record<string, FluidboxRenderer> = {};
  #observer: MutationObserver | undefined;
  #events: AbortController | undefined;
  #refreshQueued = false;
  #refreshPromise: Promise<void> = Promise.resolve();
  #preparation: FluidboxDispose | undefined;
  #preparationTimer: ReturnType<typeof setTimeout> | undefined;
  #portalTarget: HTMLElement | undefined;
  #filmstrip: FilmstripSession | undefined;
  #portalSource: FluidboxSource | undefined;
  #unsubscribe: FluidboxDispose | undefined;
  #returnFocus: HTMLElement | null = null;
  #lastStatus: FluidboxState["status"] = "closed";
  #readyWaiters: Array<{
    resolve(controller: FluidboxController): void;
    reject(error: unknown): void;
  }> = [];

  connectedCallback() {
    if (!this.hasAttribute("tabindex")) this.tabIndex = -1;
    this.#events = new AbortController();
    const { signal } = this.#events;
    this.addEventListener("click", this.#onClick, { signal });
    this.addEventListener("pointerdown", this.#onPointerDown, { signal, passive: true });
    this.addEventListener("pointerup", this.#onPointerUp, { signal, passive: true });
    this.addEventListener("pointercancel", this.#discardPreparation, { signal, passive: true });
    this.#observer = new MutationObserver((records) => {
      if (
        records.some((record) => {
          if (
            record.target instanceof Element &&
            record.target.closest("[data-fluidbox-dynamic-preview]")
          ) {
            return false;
          }
          return record.type === "childList" || SOURCE_ATTRIBUTES.has(record.attributeName ?? "");
        })
      ) {
        this.#queueRefresh();
      }
    });
    this.#observer.observe(this, { childList: true, subtree: true, attributes: true });
    this.#queueRefresh();
  }

  disconnectedCallback() {
    for (const waiter of this.#readyWaiters) {
      waiter.reject(
        new DOMException("fluidbox-gallery disconnected before it was ready.", "AbortError"),
      );
    }
    this.#readyWaiters = [];
    this.#observer?.disconnect();
    this.#observer = undefined;
    this.#events?.abort();
    this.#events = undefined;
    this.#discardPreparation();
    this.#unsubscribe?.();
    this.#unsubscribe = undefined;
    this.#filmstrip?.destroy();
    this.#filmstrip = undefined;
    this.#controller?.destroy();
    this.#controller = null;
  }

  get controller() {
    return this.#controller;
  }

  /** Resolve once the gallery controller has compiled its initial source. */
  whenReady(): Promise<FluidboxController> {
    if (this.#controller) return Promise.resolve(this.#controller);
    if (!this.isConnected) {
      return Promise.reject(
        new DOMException("fluidbox-gallery is not connected.", "InvalidStateError"),
      );
    }
    return new Promise((resolve, reject) => this.#readyWaiters.push({ resolve, reject }));
  }

  get source() {
    return this.#source;
  }

  set source(source: FluidboxSource | null) {
    this.#source = source;
    this.#queueRefresh();
  }

  get origins() {
    return this.#origins;
  }

  set origins(origins: FluidboxOriginAdapter | undefined) {
    this.#origins = origins;
  }

  get itemCount() {
    return this.#sourceSnapshot.count;
  }

  async open(target: FluidboxTarget) {
    return this.#open(target, "api");
  }

  async #open(target: FluidboxTarget, reason: "api" | "trigger") {
    await Promise.resolve();
    await this.#refreshPromise;
    const controller = this.#requireController();
    this.#captureReturnFocus(controller.state);
    return controller.open(target, { reason });
  }

  close() {
    return this.#requireController().close({ reason: "api" });
  }

  next() {
    return this.#requireController().next({ reason: "api" });
  }

  previous() {
    return this.#requireController().previous({ reason: "api" });
  }

  #requireController() {
    if (!this.#controller)
      throw new DOMException("fluidbox-gallery is not connected yet.", "InvalidStateError");
    return this.#controller;
  }

  #queueRefresh() {
    if (!this.isConnected || this.#refreshQueued) return;
    this.#refreshQueued = true;
    queueMicrotask(() => {
      this.#refreshQueued = false;
      if (this.isConnected) {
        this.#refreshPromise = this.#refreshPromise
          .then(() => this.#refresh())
          .catch((error) => {
            for (const waiter of this.#readyWaiters) waiter.reject(error);
            this.#readyWaiters = [];
            throw error;
          });
      }
    });
  }

  async #refresh() {
    const definitions = new Map<string, DeclarativeFluidboxDefinition>();
    const renderers: Record<string, FluidboxRenderer> = {};
    let source = this.#source;
    if (!source) {
      const lightboxes = Array.from(this.children).filter(
        (child): child is FluidboxItemElement => child instanceof FluidboxItemElement,
      );
      const items = lightboxes.map((lightbox) => {
        const definition = lightbox.compile();
        if (definitions.has(definition.item.id)) {
          throw new TypeError(`Duplicate declarative lightbox item id: ${definition.item.id}`);
        }
        definitions.set(definition.item.id, definition);
        if (definition.renderer) renderers[definition.renderer[0]] = definition.renderer[1];
        return definition.item;
      });
      source = arraySource(items);
    }
    this.#definitions = definitions;
    for (const key of Object.keys(this.#renderers)) delete this.#renderers[key];
    Object.assign(this.#renderers, renderers);
    this.#sourceSnapshot = source;
    if (!this.#controller) {
      this.#controller = createFluidbox({
        source,
        origins: {
          getOrigin: (id) =>
            this.#definitions.get(id)?.origin ?? this.#origins?.getOrigin(id) ?? null,
          revealOrigin: (id, index, context) => {
            if (this.#origins?.revealOrigin) {
              return this.#origins.revealOrigin(id, index, context);
            }
            const origin = this.#definitions.get(id)?.origin ?? this.#origins?.getOrigin(id);
            origin?.trigger.scrollIntoView({
              behavior: "instant",
              block: "nearest",
              inline: "nearest",
            });
          },
        },
        renderers: this.#renderers,
        portal: { mount: (context) => this.#mountPortal(context.target, context.controller) },
      });
      this.#unsubscribe = this.#controller.subscribe((state) => this.#paintState(state));
    } else {
      await this.#controller.setSource(source);
    }
    this.#paintState(this.#controller.state);
    this.#rebuildFilmstrip();
    for (const waiter of this.#readyWaiters) waiter.resolve(this.#controller);
    this.#readyWaiters = [];
  }

  #mountPortal(target: HTMLElement, controller: FluidboxController) {
    this.#portalTarget = target;
    const ownerDocument = target.ownerDocument;
    const close = button(ownerDocument, "close", "Close");
    const previous = button(ownerDocument, "previous", "Previous");
    const next = button(ownerDocument, "next", "Next");
    close.addEventListener("click", () => void controller.close({ reason: "api" }));
    previous.addEventListener("click", () => void controller.previous({ reason: "api" }));
    next.addEventListener("click", () => void controller.next({ reason: "api" }));
    target.append(previous, next);
    if (!this.hasAttribute("hide-close-button")) target.append(close);
    this.#rebuildFilmstrip();
    return () => {
      this.#filmstrip?.destroy();
      this.#filmstrip = undefined;
      this.#portalTarget = undefined;
      target.replaceChildren();
    };
  }

  #rebuildFilmstrip() {
    const target = this.#portalTarget;
    const controller = this.#controller;
    const wantsFilmstrip =
      this.#sourceSnapshot.count > 1 && !!this.querySelector(":scope > fluidbox-filmstrip");
    if (!target || !controller) return;
    if (
      this.#filmstrip &&
      this.#portalSource === this.#sourceSnapshot &&
      wantsFilmstrip === this.#filmstrip.element.isConnected
    ) {
      return;
    }
    this.#filmstrip?.destroy();
    this.#filmstrip = undefined;
    this.#portalSource = this.#sourceSnapshot;
    const dialog = target.closest<HTMLElement>("[data-fluidbox-dialog]");
    dialog?.toggleAttribute("data-filmstrip", wantsFilmstrip);
    if (!wantsFilmstrip) return;
    const index = controller.state.requestedIndex ?? controller.state.activeIndex ?? 0;
    this.#filmstrip = new FilmstripSession(
      target.ownerDocument,
      this.#sourceSnapshot,
      controller,
      index,
    );
    target.append(this.#filmstrip.dock);
    this.#filmstrip.mount();
  }

  #paintState(state: FluidboxState) {
    const selectedId = state.requestedId ?? state.activeId;
    for (const [id, definition] of this.#definitions) {
      definition.origin.trigger.setAttribute(
        "aria-expanded",
        String(id === selectedId && state.status !== "closed"),
      );
    }
    const previous = this.#portalTarget?.querySelector<HTMLButtonElement>(
      "[data-fluidbox-previous]",
    );
    const next = this.#portalTarget?.querySelector<HTMLButtonElement>("[data-fluidbox-next]");
    if (previous) previous.disabled = !state.canPrevious;
    if (next) next.disabled = !state.canNext;
    const index = state.requestedIndex ?? state.activeIndex;
    if (index !== null) this.#filmstrip?.sync(index);
    if (state.status === "closed" && this.#lastStatus !== "closed") {
      const target = this.#returnFocus?.isConnected ? this.#returnFocus : this;
      target.focus({ preventScroll: true });
      this.#returnFocus = null;
    }
    this.#lastStatus = state.status;
  }

  #captureReturnFocus(state: FluidboxState) {
    if (state.status !== "closed") return;
    const active = this.ownerDocument.activeElement;
    this.#returnFocus = active instanceof HTMLElement ? active : this;
  }

  #declarativeTarget(event: Event) {
    const target = event.target;
    if (!(target instanceof Element)) return null;
    const lightbox = target.closest<FluidboxItemElement>("fluidbox-item");
    if (!lightbox || lightbox.parentElement !== this || !lightbox.trigger.contains(target))
      return null;
    return lightbox;
  }

  #onClick = (event: MouseEvent) => {
    const lightbox = this.#declarativeTarget(event);
    if (!lightbox || event.defaultPrevented) return;
    void this.#open({ id: lightbox.openItemId ?? lightbox.itemId }, "trigger");
  };

  #onPointerDown = (event: PointerEvent) => {
    const lightbox = this.#declarativeTarget(event);
    if (!lightbox || !event.isPrimary || event.button !== 0) return;
    this.#discardPreparation();
    this.#preparation = this.#controller?.prepare({ id: lightbox.openItemId ?? lightbox.itemId });
  };

  #onPointerUp = () => {
    clearTimeout(this.#preparationTimer);
    this.#preparationTimer = setTimeout(this.#discardPreparation, 250);
  };

  #discardPreparation = () => {
    clearTimeout(this.#preparationTimer);
    this.#preparationTimer = undefined;
    this.#preparation?.();
    this.#preparation = undefined;
  };
}

if (!customElements.get("fluidbox-gallery"))
  customElements.define("fluidbox-gallery", FluidboxGalleryElement);
