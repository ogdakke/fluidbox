import {
  ApplicationRef,
  Component,
  Directive,
  InjectionToken,
  Injector,
  NgZone,
  TemplateRef,
  computed,
  inject,
  input,
  signal,
  type OnChanges,
  type OnDestroy,
  type OnInit,
  type Signal,
  type SimpleChanges,
} from "@angular/core";
import type {
  FluidboxIframeItem,
  FluidboxImageItem,
  FluidboxItem,
  FluidboxPlaybackSource,
  FluidboxSlide,
  FluidboxSlideOrigin,
  FluidboxSlideRenderer,
  FluidboxVideoItem,
  FluidboxVideoOptions,
  FluidboxZoomPose,
} from "@ogdakke/fluidbox";
import { mountView, whenDeferred, type FluidboxItemContext, type Mounted } from "./mount.js";
import { injectRoot, internalsOf, type FluidboxSlidePart } from "./root.js";

// The package build leaves the NODE_ENV check for the app's bundler, which
// drops the messages in production. A page without a bundler has no process.
declare const process: { env: { NODE_ENV?: string } };

/** The slide a part is inside, from `injectFluidboxSlide()`. */
export interface FluidboxSlideApi<TItem extends FluidboxItem = FluidboxItem> {
  readonly item: Signal<TItem>;
  /** The item's index, which new items can change: a slide whose item moved stays. */
  readonly index: Signal<number>;
  /** Whether the slide is the one on show. */
  readonly active: Signal<boolean>;
  /** True while an open waits for this slide. Read live. */
  readonly opening: boolean;
  /**
   * What the trigger showed, on the slide an open started from it: `video`
   * reads the trigger's `<video>` live. Null on the other slides. Read live,
   * as an open can start from a trigger after the slide rendered.
   */
  readonly origin: FluidboxSlideOrigin | null;
  /** Aborted when the slide unloads. */
  readonly signal: AbortSignal;
  onActiveChange(this: void, listener: (active: boolean) => void): () => void;
  /**
   * Hand the playback back to the trigger's video as the viewer closes from
   * this slide. Returns a function that unregisters it; call it in ngOnDestroy.
   */
  returnPlayback(this: void, source: FluidboxPlaybackSource): () => void;
  /** Make the opening flight also wait for this promise. Call it in the constructor or ngOnInit. */
  waitUntil(this: void, promise: Promise<unknown>): void;
  /** Put the slide in its error state, with `error` as the `mediaerror`'s cause. */
  fail(this: void, error?: unknown): void;
  /** Follow the box's zoom pose. Returns a function that stops listening. */
  onZoom(this: void, listener: (pose: FluidboxZoomPose) => void): () => void;
}

/** The slide a part renders in, as the parts inside it inject it. */
export interface SlideScope<TItem extends FluidboxItem = FluidboxItem> {
  readonly slide: FluidboxSlide<TItem>;
  readonly api: FluidboxSlideApi<TItem>;
}

export const SLIDE = new InjectionToken<SlideScope<any>>("fluidbox slide");

/** The slide around a part, or null outside one. */
export function injectSlideScope<
  TItem extends FluidboxItem = FluidboxItem,
>(): SlideScope<TItem> | null {
  return inject(SLIDE, { optional: true });
}

function requireSlide<TItem extends FluidboxItem>(part: string): SlideScope<TItem> {
  const scope = injectSlideScope<TItem>();
  if (!scope)
    throw new Error(
      (() => {
        try {
          if (process.env.NODE_ENV !== "production")
            return `${part} must be inside a slide: an ng-template with fluidboxSlide.`;
        } catch {}
        return "fluidbox";
      })(),
    );
  return scope;
}

/**
 * The slide this component or directive is inside: its item and index, whether
 * it is on show, and its hooks into the open. Call in an injection context.
 */
export function injectFluidboxSlide<
  TItem extends FluidboxItem = FluidboxItem,
>(): FluidboxSlideApi<TItem> {
  return requireSlide<TItem>("injectFluidboxSlide()").api;
}

type SlideContext<TItem extends FluidboxItem> = FluidboxItemContext<TItem> & { active: boolean };

/**
 * The slide for an item type: `<ng-template fluidboxSlide="note" let-item>`,
 * or with no value, for any type without its own and without a built-in
 * slide. The template renders in the slide's layer, with a `fluidboxMedia`
 * template for its box. Components inside reach the slide with
 * `injectFluidboxSlide()`.
 *
 * The open waits for the slide: for its first check, for `@defer` blocks in it
 * to show their content, then for the images and videos in its box and any
 * `waitUntil`, at most three seconds in all.
 */
@Directive({ selector: "ng-template[fluidboxSlide]", standalone: true })
export class FluidboxSlideDirective<TItem extends FluidboxItem = FluidboxItem>
  implements FluidboxSlidePart<TItem>, OnInit, OnDestroy
{
  /** The item type it draws; empty for the default slide. */
  readonly fluidboxSlide = input<string>("");

  readonly #root = injectRoot<TItem>("fluidboxSlide");
  readonly #template = inject<TemplateRef<SlideContext<TItem>>>(TemplateRef);
  readonly #injector = inject(Injector);
  readonly #zone = inject(NgZone);
  readonly #app = inject(ApplicationRef);
  #unregister: (() => void) | undefined;

  static ngTemplateContextGuard<TItem extends FluidboxItem>(
    _directive: FluidboxSlideDirective<TItem>,
    _context: unknown,
  ): _context is SlideContext<TItem> {
    return true;
  }

  ngOnInit(): void {
    this.#unregister = internalsOf(this.#root).slide(this.fluidboxSlide() || "default", this);
  }

  ngOnDestroy(): void {
    this.#unregister?.();
  }

  render(slide: FluidboxSlide<TItem>, release: () => void): () => void {
    const root = this.#root;
    const active = signal(slide.active);
    // Read live: new items can move the slide's item.
    const index = computed(() => {
      root.list();
      return slide.index;
    });
    const api: FluidboxSlideApi<TItem> = {
      item: signal(slide.item).asReadonly(),
      index,
      active: active.asReadonly(),
      get opening() {
        return slide.opening;
      },
      get origin() {
        return slide.origin;
      },
      signal: slide.signal,
      onActiveChange: slide.onActiveChange,
      returnPlayback: slide.returnPlayback,
      waitUntil: slide.waitUntil,
      fail: slide.fail,
      onZoom: slide.onZoom,
    };
    const context: SlideContext<TItem> = {
      $implicit: slide.item,
      item: slide.item,
      get index() {
        return slide.index;
      },
      active: slide.active,
    };
    const injector = Injector.create({
      providers: [{ provide: SLIDE, useValue: { slide, api } satisfies SlideScope<TItem> }],
      parent: this.#injector,
    });
    const mounted: Mounted<SlideContext<TItem>> = mountView(
      this.#zone,
      this.#app,
      this.#template,
      context,
      slide.layer,
      injector,
    );
    const stopActive = slide.onActiveChange((now) =>
      this.#zone.run(() => {
        active.set(now);
        context.active = now;
        mounted.check();
      }),
    );
    // New items can move the slide's item, and the template reads its index.
    let items = root.list();
    const stopItems = internalsOf(root).watch(() => {
      if (root.fluidbox.items === items) return;
      items = root.fluidbox.items;
      mounted.check();
    });
    // The view has rendered, and the parts in it have drawn into the box and
    // called waitUntil. Content in a @defer block holds the commit until it shows.
    const stopDeferred = whenDeferred(mounted.view, mounted.check, release);
    return () => {
      stopDeferred();
      stopActive();
      stopItems();
      mounted.dispose();
    };
  }
}

/**
 * The slide's media box: the element that flies, follows a drag to dismiss
 * and zooms. It is the viewer's own element; the template's content renders
 * into it, and `render` draws into it with a plain-JS slide renderer, as the
 * add-on parts do. Fill it: the box is sized from the item.
 *
 * ```html
 * <ng-template fluidboxSlide="product" let-item>
 *   <ng-template fluidboxMedia><fluidbox-image [item]="item.image" /></ng-template>
 *   <p class="price">{{ item.price }}</p>
 * </ng-template>
 * ```
 */
@Directive({ selector: "ng-template[fluidboxMedia]", standalone: true })
export class FluidboxMediaDirective implements OnChanges, OnInit, OnDestroy {
  /**
   * Whether pinch, double-tap, wheel and the zoom controls zoom the box.
   * @default true when it holds a fluidbox-image, else false
   */
  readonly zoom = input<boolean | undefined>(undefined);
  /** Draw into the box with a plain-JS slide renderer. A new one draws afresh. */
  readonly render = input<FluidboxSlideRenderer<any> | undefined>(undefined);

  readonly #scope = requireSlide("fluidboxMedia");
  readonly #template = inject<TemplateRef<unknown>>(TemplateRef);
  readonly #injector = inject(Injector);
  readonly #zone = inject(NgZone);
  readonly #app = inject(ApplicationRef);
  #content: Mounted<unknown> | undefined;
  #drawn: (() => void) | undefined;
  #ready = false;

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.#ready) return;
    if (changes["render"]) this.#draw();
    if (changes["zoom"]) this.#zoomable();
  }

  ngOnInit(): void {
    this.#ready = true;
    // Drawn before the content, as the content's parts may draw too.
    this.#draw();
    this.#content = mountView(
      this.#zone,
      this.#app,
      this.#template,
      {},
      this.#scope.slide.media,
      this.#injector,
    );
    // After the content's, so an explicit zoom wins over fluidbox-image's.
    this.#zoomable();
  }

  ngOnDestroy(): void {
    this.#drawn?.();
    this.#content?.dispose();
  }

  #draw(): void {
    this.#drawn?.();
    this.#drawn = undefined;
    const render = this.render();
    if (!render) return;
    const { slide } = this.#scope;
    // Its own signal and the nodes it adds go when it does, so a new render
    // function draws afresh.
    const scope = new AbortController();
    slide.signal.addEventListener("abort", () => scope.abort(), {
      once: true,
      signal: scope.signal,
    });
    const before = new Set(slide.media.childNodes);
    const dispose = render(Object.create(slide, { signal: { value: scope.signal } }));
    this.#drawn = () => {
      dispose?.();
      scope.abort();
      for (const node of [...slide.media.childNodes]) if (!before.has(node)) node.remove();
    };
  }

  #zoomable(): void {
    const zoom = this.zoom();
    if (zoom !== undefined) this.#scope.slide.zoomable(zoom);
  }
}

/** Draw one of the built-in media into the slide's box, again as its item changes. */
@Directive({ standalone: true })
abstract class FluidboxDrawDirective<TDrawn extends FluidboxItem>
  implements OnChanges, OnInit, OnDestroy
{
  abstract readonly item: Signal<TDrawn | undefined>;
  protected abstract readonly slide: FluidboxSlide<any>;
  #key: string | undefined;
  #with: unknown;
  #undraw: (() => void) | undefined;

  protected abstract draw(item: TDrawn | undefined): () => void;
  /** What else draws it afresh when it changes. */
  protected drawnWith(): unknown {
    return undefined;
  }

  ngOnChanges(): void {
    if (this.#undraw) this.ngOnInit();
  }

  ngOnInit(): void {
    // Compared by value, so an inline object changes nothing.
    const key = JSON.stringify(this.item() ?? null);
    const drawnWith = this.drawnWith();
    if (this.#undraw && key === this.#key && drawnWith === this.#with) return;
    this.#key = key;
    this.#with = drawnWith;
    this.#undraw?.();
    this.#undraw = this.draw(this.item());
  }

  ngOnDestroy(): void {
    this.#undraw?.();
  }
}

/**
 * The built-in image in the slide's box: it loads, sharpens and fails as a
 * photo's does, and makes the box zoom. Renders nothing itself.
 */
@Component({ selector: "fluidbox-image", standalone: true, template: "", host: { hidden: "" } })
export class FluidboxImageComponent extends FluidboxDrawDirective<FluidboxImageItem> {
  /** @default the slide's item */
  readonly item = input<FluidboxImageItem | undefined>(undefined);
  protected readonly slide = requireSlide("fluidbox-image").slide;
  protected draw(item: FluidboxImageItem | undefined) {
    return this.slide.drawImage(item);
  }
}

/** The built-in video in the slide's box. `attach` loads the media yourself; pass a stable function. */
@Component({ selector: "fluidbox-video", standalone: true, template: "", host: { hidden: "" } })
export class FluidboxVideoComponent extends FluidboxDrawDirective<FluidboxVideoItem> {
  /** @default the slide's item */
  readonly item = input<FluidboxVideoItem | undefined>(undefined);
  /** Load the media into the runtime's `<video>` yourself, as a streaming engine does. A new one loads the video again. */
  readonly attach = input<FluidboxVideoOptions["attach"]>(undefined);
  protected readonly slide = requireSlide("fluidbox-video").slide;
  protected override drawnWith() {
    return this.attach();
  }
  protected draw(item: FluidboxVideoItem | undefined) {
    const attach = this.attach();
    return this.slide.drawVideo(item, attach && { attach });
  }
}

/** The built-in iframe in the slide's box. */
@Component({ selector: "fluidbox-iframe", standalone: true, template: "", host: { hidden: "" } })
export class FluidboxIframeComponent extends FluidboxDrawDirective<FluidboxIframeItem> {
  /** @default the slide's item */
  readonly item = input<FluidboxIframeItem | undefined>(undefined);
  protected readonly slide = requireSlide("fluidbox-iframe").slide;
  protected draw(item: FluidboxIframeItem | undefined) {
    return this.slide.drawIframe(item);
  }
}
