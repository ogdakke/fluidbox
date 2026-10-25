import {
  ApplicationRef,
  ChangeDetectorRef,
  Component,
  ContentChild,
  Directive,
  ElementRef,
  InjectionToken,
  Injector,
  NgZone,
  Renderer2,
  TemplateRef,
  ViewChild,
  ViewContainerRef,
  computed,
  inject,
  input,
  numberAttribute,
  signal,
  type AfterContentChecked,
  type AfterContentInit,
  type AfterViewChecked,
  type ComponentRef,
  type DoCheck,
  type OnDestroy,
  type OnInit,
  type Signal,
} from "@angular/core";
import type {
  FluidboxControlName,
  FluidboxItem,
  FluidboxRenderer,
  FluidboxTarget,
  FluidboxViewerRenderer,
} from "@ogdakke/fluidbox";
import {
  createTrigger,
  crossOrigin,
  downloadLink,
  fluidboxControls,
  targetKeys,
  type FluidboxTriggerPreview,
} from "@ogdakke/fluidbox/kit";
import { injectIsBrowser, optionalBoolean, mountView, type FluidboxItemContext } from "./mount.js";
import { FluidboxBlockComponent, FluidboxOutletDirective } from "./outlet.js";
import { injectRoot, internalsOf } from "./root.js";
import { injectSlideScope } from "./slide.js";

// The package build leaves the NODE_ENV check for the app's bundler, which
// drops the messages in production. A page without a bundler has no process.
declare const process: { env: { NODE_ENV?: string } };

const sameKeys = (a: readonly unknown[], b: readonly unknown[]) =>
  a.length === b.length && a.every((value, index) => value === b[index]);

/**
 * Opens an item, on any element: `[fluidboxTrigger]="photo.id"`, or the item
 * or its index. A list opens its first, and every one closes back onto this
 * trigger, as for an album cover. The element is registered as the origin of
 * its items, so the photo flies from it and back to it. Exported as
 * `fluidboxTrigger`, whose `preview()` is the item the trigger shows.
 *
 * Its listeners are added in ngOnInit, after the listeners of the template it
 * is in, so a `(click)` on the same element runs first and can call
 * `preventDefault()` to stop the open.
 */
@Directive({ selector: "[fluidboxTrigger]", exportAs: "fluidboxTrigger", standalone: true })
export class FluidboxTriggerDirective<TItem extends FluidboxItem = FluidboxItem>
  implements DoCheck, OnInit, OnDestroy
{
  /** The item opened: the item, its id or its index, or a list of them. */
  readonly fluidboxTrigger = input.required<
    FluidboxTarget<TItem> | readonly FluidboxTarget<TItem>[]
  >();

  readonly #root = injectRoot<TItem>("fluidboxTrigger");
  readonly #element = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly #renderer = inject(Renderer2);
  readonly #changes = inject(ChangeDetectorRef);
  readonly #zone = inject(NgZone);
  readonly #browser = injectIsBrowser();
  readonly #keys = signal<readonly (number | string)[]>([], { equal: sameKeys });
  /** The keys of its items, the first one opened. */
  readonly keys: Signal<readonly (number | string)[]> = this.#keys.asReadonly();
  readonly #previewChanges = signal(0);
  #followsPreview = false;
  readonly #trigger = createTrigger<TItem>(this.#root.fluidbox, {
    value: 0,
    onPreviewChange: () => this.#previewChanged(),
  });
  /**
   * `{ item, index, status }`: the item this trigger shows, which follows the
   * viewer while it is open. Read it in the template; it renders synchronously
   * before the closing flight measures the trigger.
   */
  readonly preview: Signal<FluidboxTriggerPreview<TItem>> = computed(() => {
    this.#followsPreview = true;
    this.#previewChanges();
    this.#root.list();
    this.#keys();
    return this.#trigger.preview(this.#root.state());
  });
  #cleanup: (() => void)[] = [];

  ngDoCheck(): void {
    const value = this.fluidboxTrigger();
    // The bare attribute binds "".
    if (value === undefined || value === null || value === "")
      throw new Error(
        (() => {
          try {
            if (process.env.NODE_ENV !== "production")
              return "fluidboxTrigger needs an item, its id or its index, or a list of them.";
          } catch {}
          return "fluidbox";
        })(),
      );
    const keys = targetKeys(value);
    if (sameKeys(keys, this.#keys())) return;
    this.#keys.set(keys);
    this.#trigger.update({ value, onPreviewChange: () => this.#previewChanged() });
  }

  ngOnInit(): void {
    this.ngDoCheck();
    if (!this.#browser) return;
    const element = this.#element.nativeElement;
    const listen = (name: string, handler: (event: PointerEvent & MouseEvent) => void) =>
      this.#cleanup.push(this.#renderer.listen(element, name, handler));
    // A press or click can load the viewer, whose listeners stay outside the zone.
    const outside = (run: () => void) => this.#zone.runOutsideAngular(run);
    listen("pointerdown", (event) => outside(() => this.#trigger.pointerDown(event)));
    listen("pointerup", () => this.#trigger.pointerUp());
    listen("pointercancel", () => this.#trigger.pointerCancel());
    listen("click", (event) => outside(() => this.#trigger.click(event)));
    if (element.localName === "button" && !element.hasAttribute("type"))
      this.#renderer.setAttribute(element, "type", "button");
    this.#trigger.setElement(element);
    // New items can make more of the targets known.
    this.#cleanup.push(internalsOf(this.#root).watch(() => this.#trigger.refresh()));
  }

  ngOnDestroy(): void {
    for (const dispose of this.#cleanup) dispose();
    this.#trigger.destroy();
  }

  /** The close flight measures right after this, so the new preview must be in the DOM. */
  #previewChanged(): void {
    this.#previewChanges.update((count) => count + 1);
    if (this.#followsPreview) this.#changes.detectChanges();
  }
}

/** True inside the live copy of an overlay that flies with the photo. */
const TRAVELLING = new InjectionToken<boolean>("fluidbox travelling overlay");

/**
 * A badge, caption or scrim on a trigger. It gets `--fluidbox-closed` and
 * `data-fluidbox-phase` as the viewer opens and closes, and goes with the
 * photo's flight as `flight` says: it stays (`"none"`), a still copy flies
 * (`"copy"`), its content renders live in the flying frame (`"live"`), or the
 * element itself moves into the frame and scales with it, as a scrim does
 * (`"frame"`). Live content is an `ng-template` child, rendered here and in
 * the frame with DI and change detection.
 *
 * ```html
 * <span fluidboxOverlay flight="live"><ng-template>+{{ count }}</ng-template></span>
 * ```
 */
@Component({
  selector: "[fluidboxOverlay]",
  standalone: true,
  template: `<ng-container #content /><ng-content />`,
  host: {
    "[attr.data-fluidbox-trigger-overlay]": "flight()",
    "[style.display]": "travelling && flight() === 'frame' ? 'none' : null",
  },
})
export class FluidboxOverlayComponent<TItem extends FluidboxItem = FluidboxItem>
  implements AfterContentInit, AfterViewChecked, OnInit, OnDestroy
{
  /** How it goes with the photo's flight. @default "none" */
  readonly flight = input<"none" | "copy" | "live" | "frame">("none");
  /** The content, rendered here and, with `flight="live"`, into the flying frame. */
  @ContentChild(TemplateRef, { descendants: false }) content?: TemplateRef<unknown>;
  @ViewChild("content", { read: ViewContainerRef, static: true })
  private readonly container!: ViewContainerRef;

  /** In the live copy a flight renders, an overlay is a picture, not another overlay. */
  protected readonly travelling = inject(TRAVELLING, { optional: true }) ?? false;
  readonly #root = injectRoot<TItem>("fluidboxOverlay");
  readonly #trigger = inject<FluidboxTriggerDirective<TItem>>(FluidboxTriggerDirective, {
    optional: true,
  });
  readonly #element = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly #injector = inject(Injector);
  readonly #zone = inject(NgZone);
  readonly #app = inject(ApplicationRef);
  readonly #browser = injectIsBrowser();
  #bound: readonly unknown[] = [];
  #release: (() => void) | undefined;
  #stop: (() => void) | undefined;

  /** Renders the content live into the flying frame. */
  readonly #live: FluidboxRenderer<TItem> = ({ target }) =>
    mountView(
      this.#zone,
      this.#app,
      this.content!,
      {},
      target,
      Injector.create({
        providers: [{ provide: TRAVELLING, useValue: true }],
        parent: this.#injector,
      }),
    ).dispose;

  ngOnInit(): void {
    if (!this.#trigger && !this.travelling)
      throw new Error(
        (() => {
          try {
            if (process.env.NODE_ENV !== "production")
              return "fluidboxOverlay must be inside an element with fluidboxTrigger.";
          } catch {}
          return "fluidbox";
        })(),
      );
  }

  ngAfterContentInit(): void {
    if (this.content) this.container.createEmbeddedView(this.content);
  }

  ngAfterViewChecked(): void {
    if (!this.#browser || this.travelling) return;
    this.#bind();
    this.#stop ??= internalsOf(this.#root).watch(() => this.#bind());
  }

  ngOnDestroy(): void {
    this.#stop?.();
    this.#release?.();
  }

  #bind(): void {
    const keys = this.#trigger!.keys();
    const flight = this.flight();
    const fluidbox = this.#root.fluidbox;
    // Overlays are found by id when they bind, so new items bind them again.
    const key = [flight, this.content, fluidbox.items, ...keys];
    if (sameKeys(key, this.#bound)) return;
    this.#bound = key;
    this.#release?.();
    this.#release = fluidbox.bindOverlay(this.#element.nativeElement, keys, {
      flight: flight === "live" ? (this.content ? { live: this.#live } : "copy") : flight,
    });
  }
}

/** Where a viewer part's template renders: the viewer's layer. */
const VIEWER = new InjectionToken<HTMLElement>("fluidbox viewer layer");

/**
 * Your own content in the viewer, such as controls and a caption. It renders
 * into the viewer's layer once the viewer exists, inside the root, so DI and
 * change detection work. Without one, the viewer has Previous, Next and Close;
 * with one, it keeps a Close until the template has its own.
 *
 * ```html
 * <ng-template fluidboxViewer><div fluidboxToolbar></div></ng-template>
 * ```
 */
@Directive({ selector: "ng-template[fluidboxViewer]", standalone: true })
export class FluidboxViewerDirective implements OnInit, OnDestroy {
  readonly #root = injectRoot("fluidboxViewer");
  readonly #template = inject<TemplateRef<unknown>>(TemplateRef);
  readonly #injector = inject(Injector);
  readonly #zone = inject(NgZone);
  readonly #app = inject(ApplicationRef);
  #disconnect: (() => void) | undefined;

  /** Draws the template into the viewer's layer. */
  readonly render: FluidboxViewerRenderer = ({ target }) =>
    mountView(
      this.#zone,
      this.#app,
      this.#template,
      {},
      target,
      Injector.create({
        providers: [{ provide: VIEWER, useValue: target }],
        parent: this.#injector,
      }),
    ).dispose;

  ngOnInit(): void {
    this.#disconnect = internalsOf(this.#root).connect("viewer", this);
  }

  ngOnDestroy(): void {
    this.#disconnect?.();
  }
}

/** No element children and no text, so a control shows its label. */
function isEmpty(element: Element): boolean {
  return ![...element.childNodes].some(
    (node) => node.nodeType === 1 || (node.nodeType === 3 && node.textContent?.trim()),
  );
}

/**
 * Names a part by the children rule: empty, it shows its label as text and
 * has `data-fluidbox-default`; with content, such as an icon, the label is its
 * `aria-label`, unless `label` is false. Your own `aria-label` wins.
 */
@Directive({
  standalone: true,
  host: {
    "[attr.aria-label]": "naming().ariaLabel",
    "[attr.data-fluidbox-default]": "naming().text === null ? null : ''",
  },
})
abstract class NamedDirective implements AfterContentInit, AfterContentChecked {
  /**
   * A string names it instead of the labels. `false` names it by its content:
   * use it when that is visible text.
   */
  readonly label = input<string | false | undefined>(undefined);
  protected readonly root = injectRoot("A fluidbox control");
  protected readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  protected readonly renderer = inject(Renderer2);
  /** Whether it was empty: null until its content has rendered. */
  readonly #empty = signal<boolean | null>(null);
  #ariaLabel: string | null = null;
  #text: Text | undefined;
  /** Its label from the labels and the state. */
  protected abstract readonly name: Signal<string>;
  /** Whether a part names itself by its children when it has any. */
  protected readonly namedByContent: boolean = false;
  protected readonly naming = computed(() => {
    const label = this.label();
    const name = typeof label === "string" ? label : this.name();
    const empty = this.#empty();
    return {
      ariaLabel:
        this.#ariaLabel ??
        (empty === false && label !== false && (label !== undefined || !this.namedByContent)
          ? name
          : null),
      text: empty ? name : null,
    };
  });

  // Content bindings and control flow have rendered by now, so bound text counts.
  ngAfterContentInit(): void {
    const element = this.element.nativeElement;
    this.#ariaLabel = element.getAttribute("aria-label");
    const empty = isEmpty(element);
    if (empty) {
      this.#text = element.ownerDocument.createTextNode("");
      this.renderer.appendChild(element, this.#text);
    }
    this.#empty.set(empty);
    this.ngAfterContentChecked();
  }

  ngAfterContentChecked(): void {
    const text = this.naming().text;
    if (this.#text && text !== null && this.#text.data !== text) this.#text.data = text;
  }
}

/** Shared behaviour of the control buttons and links. */
@Directive({
  standalone: true,
  host: {
    "[attr.disabled]": "state().disabled ? '' : null",
    "[attr.hidden]": "state().hidden ? '' : null",
    "data-fluidbox-managed": "",
  },
})
abstract class ControlDirective extends NamedDirective implements OnInit, OnDestroy {
  /** Overrides the disabled state the viewer gives the control. */
  readonly disabled = input<boolean | undefined, unknown>(undefined, {
    transform: optionalBoolean,
  });
  protected abstract readonly control: FluidboxControlName;
  protected readonly name = computed(() =>
    fluidboxControls[this.control].label(this.root.resolvedLabels(), this.root.state()),
  );
  protected readonly state = computed(() => {
    const control = fluidboxControls[this.control];
    const state = this.root.state();
    return {
      // A link has no disabled state; Download hides instead.
      disabled: this.control !== "download" && (this.disabled() ?? control.disabled(state)),
      hidden: !!control.hidden?.(this.root.fluidbox, state),
    };
  });
  readonly #zone = inject(NgZone);
  #unlisten: (() => void) | undefined;

  ngOnInit(): void {
    const control = fluidboxControls[this.control];
    const element = this.element.nativeElement;
    this.renderer.setAttribute(element, control.attribute, "");
    if (element.localName === "button" && !element.hasAttribute("type"))
      this.renderer.setAttribute(element, "type", "button");
    // Added after the template's own listeners, so a (click) there can prevent the command.
    this.#unlisten = this.renderer.listen(element, "click", (event: MouseEvent) => {
      if (event.defaultPrevented) return;
      // The viewer's frames and timers stay out of the zone; its state comes
      // back in through the root's subscription.
      this.#zone.runOutsideAngular(() => this.run(event));
    });
  }

  ngOnDestroy(): void {
    this.#unlisten?.();
  }

  protected run(event: MouseEvent): void {
    // Prevented, so the viewer's own handling of the attribute skips it.
    event.preventDefault();
    void fluidboxControls[this.control].run(this.root.fluidbox, event);
  }
}

/** Closes the viewer. Shows its label when empty. */
@Directive({ selector: "button[fluidboxClose]", standalone: true })
export class FluidboxCloseDirective extends ControlDirective {
  protected readonly control = "close";
}

/** Goes to the previous item. Shows its label when empty. */
@Directive({ selector: "button[fluidboxPrevious]", standalone: true })
export class FluidboxPreviousDirective extends ControlDirective {
  protected readonly control = "previous";
}

/** Goes to the next item. Shows its label when empty. */
@Directive({ selector: "button[fluidboxNext]", standalone: true })
export class FluidboxNextDirective extends ControlDirective {
  protected readonly control = "next";
}

/** Zooms the image in by 1.5. Shows its label when empty. */
@Directive({ selector: "button[fluidboxZoomIn]", standalone: true })
export class FluidboxZoomInDirective extends ControlDirective {
  protected readonly control = "zoomIn";
}

/** Zooms the image out by 1.5. Shows its label when empty. */
@Directive({ selector: "button[fluidboxZoomOut]", standalone: true })
export class FluidboxZoomOutDirective extends ControlDirective {
  protected readonly control = "zoomOut";
}

/** Zooms the image back out to fit. Shows its label when empty. */
@Directive({ selector: "button[fluidboxZoomReset]", standalone: true })
export class FluidboxZoomResetDirective extends ControlDirective {
  protected readonly control = "zoomReset";
}

/** Makes the open viewer fullscreen, and back. Hidden where fullscreen isn't available. */
@Directive({ selector: "button[fluidboxFullscreen]", standalone: true })
export class FluidboxFullscreenDirective extends ControlDirective {
  protected readonly control = "fullscreen";
}

/** Shares the item's link, or copies it. Hidden without a link, or a way to share it. */
@Directive({ selector: "button[fluidboxShare]", standalone: true })
export class FluidboxShareDirective extends ControlDirective {
  protected readonly control = "share";
}

/** Loads the failed media on show again, for an error of your own. */
@Directive({ selector: "button[fluidboxRetry]", standalone: true })
export class FluidboxRetryDirective extends ControlDirective {
  protected readonly control = "retry";
}

/**
 * A link that downloads the file of the item on show. Off-site files are
 * fetched, so they download too. Hidden when the item has no file.
 */
@Directive({
  selector: "a[fluidboxDownload]",
  standalone: true,
  host: {
    "[attr.href]": "link()?.href ?? null",
    "[attr.download]": "link()?.download ?? null",
  },
})
export class FluidboxDownloadDirective extends ControlDirective {
  protected readonly control = "download";
  protected readonly link = computed(() => downloadLink(this.root.state().item));

  protected override run(event: MouseEvent): void {
    const href = (event.currentTarget as HTMLAnchorElement).href;
    // A same-site file downloads by itself; elsewhere the browser would navigate.
    if (!href || !crossOrigin(href)) return;
    event.preventDefault();
    void this.root.download();
  }
}

/** A button that moves the sheet to a snap: `<button fluidboxSheetSnap="1">`. Its content names it. */
@Directive({
  selector: "button[fluidboxSheetSnap]",
  standalone: true,
  host: { "[attr.data-fluidbox-sheet-snap]": "fluidboxSheetSnap()", type: "button" },
})
export class FluidboxSheetSnapDirective extends NamedDirective {
  /** The snap it moves the sheet to. */
  readonly fluidboxSheetSnap = input.required({ transform: numberAttribute });
  protected readonly name = computed(() => this.root.resolvedLabels().sheet);
  // Its children usually name it, so the label names it only when asked.
  protected override readonly namedByContent = true;
}

const groupControls = [
  FluidboxPreviousDirective,
  FluidboxNextDirective,
  FluidboxCloseDirective,
  FluidboxZoomInDirective,
  FluidboxZoomOutDirective,
  FluidboxZoomResetDirective,
];

/** A group that renders its defaults when it is empty. */
@Directive({ standalone: true })
abstract class GroupDirective implements AfterContentInit {
  readonly #element = inject<ElementRef<HTMLElement>>(ElementRef);
  /** Empty, it shows the default controls. */
  protected empty = false;

  // The content has been projected by now, and the group's own view renders after.
  ngAfterContentInit(): void {
    this.empty = isEmpty(this.#element.nativeElement);
  }
}

/**
 * A group of controls: `<div fluidboxToolbar>`. Empty, it holds Previous, Next
 * and Close. It is a `role="group"`, not a toolbar, as the arrow keys belong
 * to the slides.
 */
@Component({
  selector: "[fluidboxToolbar]",
  standalone: true,
  imports: groupControls,
  host: { role: "group", "data-fluidbox-toolbar": "" },
  template: `<ng-content />
    @if (empty) {
      <button fluidboxPrevious></button><button fluidboxNext></button
      ><button fluidboxClose></button>
    }`,
})
export class FluidboxToolbarComponent extends GroupDirective {}

/**
 * The zoom controls' group, named like the zoomed image:
 * `<div fluidboxZoomControls>`. Empty, it holds Zoom in, Zoom out and Fit.
 */
@Component({
  selector: "[fluidboxZoomControls]",
  standalone: true,
  imports: groupControls,
  host: { role: "group", "[attr.aria-label]": "label()", "data-fluidbox-zoom-controls": "" },
  template: `<ng-content />
    @if (empty) {
      <button fluidboxZoomIn></button><button fluidboxZoomOut></button
      ><button fluidboxZoomReset></button>
    }`,
})
export class FluidboxZoomControlsComponent extends GroupDirective {
  readonly #root = injectRoot("fluidboxZoomControls");
  protected readonly label = computed(() => this.#root.resolvedLabels().zoomed);
}

/** What a `fluidboxCounter` template gets: `let-index="index" let-count="count"`. */
export interface FluidboxCounterContext {
  /** The index of the item on show, from 0. */
  index: number;
  count: number;
}

/**
 * Where the viewer is, as `1 / 4`. Hidden from screen readers, which hear the
 * slide's name. An `ng-template` child draws it in place of the label's text:
 * `<span fluidboxCounter><ng-template let-index="index" let-count="count">…</ng-template></span>`.
 */
@Component({
  selector: "[fluidboxCounter]",
  standalone: true,
  imports: [FluidboxOutletDirective],
  host: {
    "aria-hidden": "true",
    "data-fluidbox-counter": "",
    // The binding draws it, so the viewer doesn't write its text.
    "data-fluidbox-managed": "",
    "[attr.hidden]": "context() === null ? '' : null",
  },
  template: `@if (context(); as context) {
    @if (content) {
      <ng-container [fluidboxOutlet]="content" [fluidboxOutletContext]="context" />
    } @else {
      {{ text() }}
    }
  }`,
})
export class FluidboxCounterComponent {
  @ContentChild(TemplateRef, { descendants: false })
  content?: TemplateRef<FluidboxCounterContext>;
  readonly #root = injectRoot("fluidboxCounter");
  protected readonly context = computed((): FluidboxCounterContext | null => {
    const { index, count } = this.#root.state();
    return index === null ? null : { index, count };
  });
  protected readonly text = computed(() => {
    const context = this.context();
    return context && this.#root.resolvedLabels().counter(context.index, context.count);
  });
}

/**
 * The item's caption, which describes the dialog: `<p fluidboxCaption>`.
 * Inside a slide it is that slide's item; elsewhere the item on show. An
 * `ng-template` child draws it (`let-item let-index="index"`); without one
 * it shows `item.caption`. Hidden, and no description, without a caption.
 */
@Component({
  selector: "[fluidboxCaption]",
  standalone: true,
  imports: [FluidboxOutletDirective],
  host: {
    "[attr.hidden]": "shown() ? null : ''",
    "[attr.data-fluidbox-caption]": "shown() ? '' : null",
    "[attr.data-fluidbox-description]": "shown() ? '' : null",
  },
  template: `@if (content) {
      <ng-container [fluidboxOutlet]="content" [fluidboxOutletContext]="context()" />
    } @else {
      {{ context()?.item?.caption ?? "" }}
    }`,
})
export class FluidboxCaptionComponent<TItem extends FluidboxItem = FluidboxItem> {
  @ContentChild(TemplateRef, { descendants: false }) content?: TemplateRef<
    FluidboxItemContext<TItem>
  >;
  readonly #root = injectRoot<TItem>("fluidboxCaption");
  readonly #slide = injectSlideScope<TItem>();
  protected readonly context = computed((): FluidboxItemContext<TItem> | null => {
    const slide = this.#slide;
    const state = this.#root.state();
    const item = slide ? slide.slide.item : state.item;
    const index = slide ? slide.api.index() : state.index;
    return item && index !== null ? { $implicit: item, item, index } : null;
  });
  protected readonly shown = computed(() => {
    const context = this.context();
    return !!context && (!!this.content || !!context.item.caption);
  });
}

const sameValues = (a: object, b: object) =>
  sameKeys(Object.values(a), Object.values(b)) && sameKeys(Object.keys(a), Object.keys(b));

/** A slide's loading and error state, and the cause of its last `mediaerror`. */
interface SlideStatus {
  readonly busy: boolean;
  readonly error: boolean;
  readonly cause: unknown;
}

/**
 * Renders a template in a wrapper while the status of the slide it follows
 * says so: its own slide's in a slide, else the one on show.
 */
@Directive({ standalone: true })
abstract class StatusDirective<C extends object> implements OnInit, OnDestroy {
  protected readonly root = injectRoot("A fluidbox status part");
  protected readonly slide = injectSlideScope()?.slide;
  readonly #viewer = inject(VIEWER, { optional: true });
  readonly #template = inject<TemplateRef<C>>(TemplateRef);
  readonly #container = inject(ViewContainerRef);
  readonly #zone = inject(NgZone);
  readonly #causes = new Map<number, unknown>();
  readonly #events = new AbortController();
  #observer: MutationObserver | undefined;
  #block: ComponentRef<FluidboxBlockComponent> | undefined;
  #shown: C | undefined;

  /** The wrapper's attribute. */
  protected abstract readonly attribute: string;
  /** The context to show the template with, or null to show nothing. */
  protected abstract contextFor(status: SlideStatus): C | null;

  ngOnInit(): void {
    const box = this.slide
      ? this.slide.media.closest<HTMLElement>("[data-fluidbox-slide]")
      : this.#viewer?.closest<HTMLElement>("[data-fluidbox-dialog]");
    if (!box) return;
    const { signal } = this.#events;
    this.root.fluidbox.addEventListener(
      "mediaerror",
      (event) => this.#causes.set(event.index, event.cause),
      { signal },
    );
    const read = () => this.#show(box);
    this.#observer = new MutationObserver(read);
    this.#observer.observe(box, {
      attributes: true,
      attributeFilter: ["data-busy", "data-error", "data-active"],
      subtree: !this.slide,
    });
    // The item on show changes with the state.
    signal.addEventListener("abort", internalsOf(this.root).watch(read));
    read();
  }

  ngOnDestroy(): void {
    this.#observer?.disconnect();
    this.#events.abort();
    this.#block?.destroy();
  }

  #show(box: HTMLElement): void {
    const shown = this.slide ? box : box.querySelector("[data-fluidbox-slide][data-active]");
    const error = !!shown?.hasAttribute("data-error");
    const index = this.slide ? this.slide.index : this.root.fluidbox.state.index;
    const context = this.contextFor({
      busy: !!shown?.hasAttribute("data-busy"),
      error,
      cause: error && index !== null ? this.#causes.get(index) : undefined,
    });
    // The state changes often; the template renders again only when what it shows does.
    const previous = this.#shown;
    if (context && previous && sameValues(context, previous)) return;
    if (!context && !previous) return;
    this.#shown = context ?? undefined;
    this.#zone.run(() => {
      if (!context) {
        this.#block?.destroy();
        this.#block = undefined;
        return;
      }
      if (!this.#block) {
        this.#block = this.#container.createComponent(FluidboxBlockComponent);
        const element = this.#block.location.nativeElement as HTMLElement;
        element.removeAttribute("fluidboxblock");
        element.setAttribute(this.attribute, "");
        if (this.attribute === "data-fluidbox-loading") element.setAttribute("aria-hidden", "true");
        this.#block.instance.template = this.#template as TemplateRef<unknown>;
      }
      this.#block.instance.context = context;
      this.#block.changeDetectorRef.detectChanges();
    });
  }
}

/**
 * Its template, while the item on show is loading: `<ng-template
 * fluidboxLoading>`. In a slide, while that slide is. It is `aria-hidden`, as
 * the slide's `aria-busy` already says it.
 */
@Directive({ selector: "ng-template[fluidboxLoading]", standalone: true })
export class FluidboxLoadingDirective extends StatusDirective<object> {
  protected readonly attribute = "data-fluidbox-loading";
  protected contextFor({ busy }: SlideStatus) {
    return busy ? {} : null;
  }
}

/** What a `fluidboxError` template gets: the item, and the cause of its last `mediaerror`. */
export interface FluidboxErrorContext<TItem extends FluidboxItem = FluidboxItem> {
  $implicit: TItem;
  item: TItem;
  error: unknown;
}

/**
 * Its template, in place of the default error, while the item on show failed:
 * `<ng-template fluidboxError let-item let-error="error">`. In a slide, while
 * that slide has. Put a `button[fluidboxRetry]` in it to load the media again.
 */
@Directive({ selector: "ng-template[fluidboxError]", standalone: true })
export class FluidboxErrorDirective<
  TItem extends FluidboxItem = FluidboxItem,
> extends StatusDirective<FluidboxErrorContext<TItem>> {
  protected readonly attribute = "data-fluidbox-error-content";
  protected contextFor({ error, cause }: SlideStatus): FluidboxErrorContext<TItem> | null {
    const item = (this.slide ? this.slide.item : this.root.fluidbox.state.item) as TItem | null;
    return error && item ? { $implicit: item, item, error: cause } : null;
  }

  static ngTemplateContextGuard<TItem extends FluidboxItem>(
    _directive: FluidboxErrorDirective<TItem>,
    _context: unknown,
  ): _context is FluidboxErrorContext<TItem> {
    return true;
  }
}
