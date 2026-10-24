import {
  ChangeDetectorRef,
  Component,
  ContentChild,
  Directive,
  ElementRef,
  InjectionToken,
  Injector,
  Input,
  NgZone,
  Renderer2,
  TemplateRef,
  ViewChild,
  ViewContainerRef,
  booleanAttribute,
  computed,
  inject,
  numberAttribute,
  signal,
  type AfterContentInit,
  type AfterViewChecked,
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
  fluidboxControlIcon,
  fluidboxControls,
  targetKeys,
  type FluidboxTriggerPreview,
} from "@ogdakke/fluidbox/kit";
import { injectIsBrowser, mountTemplate } from "./mount.js";
import { injectRoot } from "./root.js";

const sameKeys = (a: readonly unknown[], b: readonly unknown[]) =>
  a.length === b.length && a.every((value, index) => value === b[index]);

/**
 * Opens an item, on any element: `[fluidboxTrigger]="photo"`, or its index or
 * id. The element is registered as the origin of the item and of every one in
 * `fluidboxReturns`, so the photo flies from it and back to it. Exported as
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
  /** The item opened: the item, its index or its id. */
  @Input({ required: true }) fluidboxTrigger!: FluidboxTarget<TItem>;
  /** More items that close back onto this trigger, as for an album cover. */
  @Input() fluidboxReturns?: readonly FluidboxTarget<TItem>[];

  readonly #root = injectRoot<TItem>("fluidboxTrigger");
  readonly #element = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly #renderer = inject(Renderer2);
  readonly #changes = inject(ChangeDetectorRef);
  readonly #zone = inject(NgZone);
  readonly #browser = injectIsBrowser();
  readonly #target = signal<FluidboxTarget<TItem>>(0);
  readonly #returns = signal<readonly FluidboxTarget<TItem>[]>([], { equal: sameKeys });
  #keys: readonly unknown[] = [];
  /** The item opened. */
  readonly target: Signal<FluidboxTarget<TItem>> = this.#target.asReadonly();
  /** The other items that return here. */
  readonly returns: Signal<readonly FluidboxTarget<TItem>[]> = this.#returns.asReadonly();
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
    this.#target();
    this.#returns();
    return this.#trigger.preview(this.#root.state());
  });
  #cleanup: (() => void)[] = [];

  ngDoCheck(): void {
    const target = this.fluidboxTrigger;
    // The bare attribute binds "".
    if (target === undefined || target === null || target === "")
      throw new Error("fluidboxTrigger needs an item, its index or its id.");
    const returns = this.fluidboxReturns ?? [];
    const keys = targetKeys([target, ...returns]);
    if (sameKeys(keys, this.#keys)) return;
    this.#keys = keys;
    this.#target.set(target);
    this.#returns.set(returns);
    this.#trigger.update({
      value: [target, ...returns],
      onPreviewChange: () => this.#previewChanged(),
    });
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
    this.#cleanup.push(this.#root.watch(() => this.#trigger.refresh()));
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

/** True inside the copy of a thumbnail overlay that flies with the photo. */
const TRAVELLING = new InjectionToken<boolean>("fluidbox travelling overlay");

/**
 * A badge or caption on a thumbnail, such as a count, that fades as the photo
 * leaves and returns. It belongs to the enclosing trigger's item and returns.
 *
 * With `travel` its content flies with the photo. Give the content as an
 * `ng-template` child and the flying copy is rendered from it, live, with
 * DI and change detection; plain content flies as a still copy.
 *
 * ```html
 * <span fluidboxThumbnailOverlay travel>
 *   <ng-template>+{{ count }}</ng-template>
 * </span>
 * ```
 */
@Component({
  selector: "[fluidboxThumbnailOverlay]",
  standalone: true,
  template: `<ng-container #content /><ng-content />`,
})
export class FluidboxThumbnailOverlayComponent<TItem extends FluidboxItem = FluidboxItem>
  implements AfterContentInit, AfterViewChecked, OnInit, OnDestroy
{
  /** Fly with the photo. */
  @Input({ transform: booleanAttribute }) travel = false;
  /** The content, rendered here and, with `travel`, into the flying frame. */
  @ContentChild(TemplateRef, { descendants: false }) content?: TemplateRef<unknown>;
  @ViewChild("content", { read: ViewContainerRef, static: true })
  private readonly container!: ViewContainerRef;

  readonly #root = injectRoot<TItem>("fluidboxThumbnailOverlay");
  readonly #trigger = inject<FluidboxTriggerDirective<TItem>>(FluidboxTriggerDirective, {
    optional: true,
  });
  readonly #element = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly #injector = inject(Injector);
  readonly #zone = inject(NgZone);
  readonly #browser = injectIsBrowser();
  #bound: readonly unknown[] = [];
  #release: (() => void) | undefined;
  #stop: (() => void) | undefined;
  /** The fluidboxFrameLayer inside, which stays the same while it flies. */
  #layer: HTMLElement | undefined;

  /** Renders the content into the flying frame, without its frame layer. */
  readonly #travel: FluidboxRenderer<TItem> = ({ target }) =>
    mountTemplate(
      this.#zone,
      this.container,
      this.content!,
      {},
      target,
      Injector.create({
        providers: [{ provide: TRAVELLING, useValue: true }],
        parent: this.#injector,
      }),
    );

  ngOnInit(): void {
    if (!this.#trigger)
      throw new Error("fluidboxThumbnailOverlay must be inside an element with fluidboxTrigger.");
  }

  ngAfterContentInit(): void {
    if (this.content) this.container.createEmbeddedView(this.content);
  }

  ngAfterViewChecked(): void {
    if (!this.#browser) return;
    this.#bind();
    this.#stop ??= this.#root.watch(() => this.#bind());
  }

  ngOnDestroy(): void {
    this.#stop?.();
    this.#release?.();
  }

  /** For fluidboxFrameLayer: the element that flies, or `undefined` when it goes. */
  setFrameLayer(layer: HTMLElement | undefined): void {
    this.#layer = layer;
  }

  #bind(): void {
    const trigger = this.#trigger!;
    const element = this.#element.nativeElement;
    const target = trigger.target();
    const returns = trigger.returns();
    const flight = !this.travel ? "none" : this.content ? { live: this.#travel } : "copy";
    // While the layer flies it is out of the overlay, so a lookup finds nothing;
    // the bound one, still in the page, is in the flying frame and stays.
    const bound = this.#bound[1];
    const flying = bound instanceof HTMLElement && bound.isConnected ? bound : undefined;
    const frameLayer = this.travel
      ? (this.#layer ??
        element.querySelector<HTMLElement>(
          '[data-fluidbox-trigger-overlay="frame"]:not([data-fluidbox-ghost])',
        ) ??
        flying)
      : undefined;
    const value = [target, ...returns];
    // Overlays are found by id when they bind, so new items bind them again.
    const key = [this.travel, frameLayer, this.#root.fluidbox.items, ...targetKeys(value)];
    if (sameKeys(key, this.#bound)) return;
    this.#bound = key;
    this.#release?.();
    const fluidbox = this.#root.fluidbox;
    const unbind = fluidbox.bindOverlay(element, value, { flight });
    // The frame layer flies as an overlay of its own, beside this one.
    const unbindLayer = frameLayer
      ? fluidbox.bindOverlay(frameLayer, value, { flight: "frame" })
      : undefined;
    this.#release = () => {
      unbind();
      unbindLayer?.();
    };
  }
}

/**
 * Marks an element inside a travelling `fluidboxThumbnailOverlay` as its frame
 * layer: the element itself moves into the flying frame for the flight, scaled
 * with the photo, and comes back after, so it is left out of the live copy.
 */
@Directive({
  selector: "[fluidboxFrameLayer]",
  standalone: true,
  host: {
    "data-fluidbox-trigger-overlay": "frame",
    "[style.display]": "travelling ? 'none' : null",
  },
})
export class FluidboxFrameLayerDirective implements OnInit, OnDestroy {
  /** In the flying copy, where the moved original stands in for it. */
  protected readonly travelling = inject(TRAVELLING, { optional: true }) ?? false;
  readonly #overlay = inject(FluidboxThumbnailOverlayComponent, { optional: true });
  readonly #element = inject<ElementRef<HTMLElement>>(ElementRef);

  ngOnInit(): void {
    if (!this.travelling) this.#overlay?.setFrameLayer(this.#element.nativeElement);
  }

  ngOnDestroy(): void {
    if (!this.travelling) this.#overlay?.setFrameLayer(undefined);
  }
}

/**
 * Your own content in the viewer, such as controls and a caption. It renders
 * once the viewer exists, inside the root, so DI and change detection work.
 * Without one, the viewer has the default controls; inside one,
 * `fluidboxControls` stands for them.
 *
 * ```html
 * <ng-template fluidboxViewer><app-caption /></ng-template>
 * ```
 */
@Directive({ selector: "ng-template[fluidboxViewer]", standalone: true })
export class FluidboxViewerDirective implements OnInit, OnDestroy {
  readonly #root = injectRoot("fluidboxViewer");
  readonly #template = inject<TemplateRef<unknown>>(TemplateRef);
  readonly #container = inject(ViewContainerRef);
  readonly #zone = inject(NgZone);
  #disconnect: (() => void) | undefined;

  /** Draws the template into the viewer's layer. */
  readonly render: FluidboxViewerRenderer = ({ target }) =>
    mountTemplate(this.#zone, this.#container, this.#template, {}, target);

  ngOnInit(): void {
    this.#disconnect = this.#root.connect("viewer", this);
  }

  ngOnDestroy(): void {
    this.#disconnect?.();
  }
}

/** Moves the sheet to a stop when clicked, in the viewer or in the sheet. */
@Directive({
  selector: "button[fluidboxSheetStop]",
  standalone: true,
  host: { "[attr.data-fluidbox-sheet-snap]": "fluidboxSheetStop", type: "button" },
})
export class FluidboxSheetStopDirective {
  @Input({ required: true, transform: numberAttribute }) fluidboxSheetStop!: number;
}

const SVG = "http://www.w3.org/2000/svg";

/** Shared behaviour of the close, previous and next buttons. */
@Directive({
  standalone: true,
  host: { "[attr.disabled]": "(disabled ?? isDisabled()) ? '' : null" },
})
export abstract class FluidboxControlDirective implements OnInit, AfterContentInit, OnDestroy {
  /** Overrides the disabled state the viewer gives the control. */
  @Input() disabled?: boolean;
  protected abstract readonly control: FluidboxControlName;
  readonly #root = injectRoot("A fluidbox control");
  readonly #element = inject<ElementRef<HTMLButtonElement>>(ElementRef);
  readonly #renderer = inject(Renderer2);
  readonly isDisabled: Signal<boolean> = computed(() =>
    fluidboxControls[this.control].disabled(this.#root.state()),
  );
  #unlisten: (() => void) | undefined;

  ngOnInit(): void {
    const control = fluidboxControls[this.control];
    const element = this.#element.nativeElement;
    const renderer = this.#renderer;
    renderer.setAttribute(element, control.attribute, "");
    // Its disabled state is the binding's, not the viewer's.
    renderer.setAttribute(element, "data-fluidbox-managed", "");
    if (!element.hasAttribute("type")) renderer.setAttribute(element, "type", "button");
    // Added after the template's own listeners, so a (click) there can prevent the command.
    this.#unlisten = renderer.listen(element, "click", (event: MouseEvent) => {
      if (event.defaultPrevented) return;
      // Prevented, so the viewer's own handling of the attribute skips it.
      event.preventDefault();
      void control.run(this.#root.fluidbox, event);
    });
  }

  // Content bindings and control flow have rendered by now, so bound text counts.
  ngAfterContentInit(): void {
    const element = this.#element.nativeElement;
    if (!isEmpty(element)) return;
    if (!element.hasAttribute("aria-label")) {
      const label = fluidboxControls[this.control].label(this.#root.resolvedLabels());
      this.#renderer.setAttribute(element, "aria-label", label);
    }
    this.#renderer.appendChild(element, this.#icon());
  }

  ngOnDestroy(): void {
    this.#unlisten?.();
  }

  #icon(): SVGSVGElement {
    const renderer = this.#renderer;
    const svg = renderer.createElement("svg", SVG) as SVGSVGElement;
    for (const [name, value] of Object.entries(fluidboxControlIcon.attributes))
      renderer.setAttribute(svg, name, value);
    renderer.setAttribute(svg, "data-fluidbox-icon", "");
    const path = renderer.createElement("path", SVG) as SVGPathElement;
    renderer.setAttribute(path, "d", fluidboxControlIcon.paths[this.control]);
    renderer.appendChild(svg, path);
    return svg;
  }
}

/** No element children and no text, so the control gets the default icon. */
function isEmpty(element: Element): boolean {
  return ![...element.childNodes].some(
    (node) => node.nodeType === 1 || (node.nodeType === 3 && node.textContent?.trim()),
  );
}

/** Closes the viewer. Shows the default icon and label when empty. */
@Directive({ selector: "button[fluidboxClose]", standalone: true })
export class FluidboxCloseDirective extends FluidboxControlDirective {
  protected readonly control = "close";
}

/** Goes to the previous item. Shows the default icon and label when empty. */
@Directive({ selector: "button[fluidboxPrevious]", standalone: true })
export class FluidboxPreviousDirective extends FluidboxControlDirective {
  protected readonly control = "previous";
}

/** Goes to the next item. Shows the default icon and label when empty. */
@Directive({ selector: "button[fluidboxNext]", standalone: true })
export class FluidboxNextDirective extends FluidboxControlDirective {
  protected readonly control = "next";
}

/** Zooms the image in by 1.5. Shows the default icon and label when empty. */
@Directive({ selector: "button[fluidboxZoomIn]", standalone: true })
export class FluidboxZoomInDirective extends FluidboxControlDirective {
  protected readonly control = "zoomIn";
}

/** Zooms the image out by 1.5. Shows the default icon and label when empty. */
@Directive({ selector: "button[fluidboxZoomOut]", standalone: true })
export class FluidboxZoomOutDirective extends FluidboxControlDirective {
  protected readonly control = "zoomOut";
}

/** Zooms the image back out to fit. Shows the default icon and label when empty. */
@Directive({ selector: "button[fluidboxZoomReset]", standalone: true })
export class FluidboxZoomResetDirective extends FluidboxControlDirective {
  protected readonly control = "zoomReset";
}

/**
 * The default Previous, Next and Close buttons, for a `fluidboxViewer`
 * template: `<div fluidboxControls></div>`, and with `zoom` the zoom controls
 * in their group: `<div fluidboxControls zoom></div>`. Its element takes no box.
 */
@Component({
  selector: "[fluidboxControls]",
  standalone: true,
  imports: [
    FluidboxPreviousDirective,
    FluidboxNextDirective,
    FluidboxCloseDirective,
    FluidboxZoomInDirective,
    FluidboxZoomOutDirective,
    FluidboxZoomResetDirective,
  ],
  host: { style: "display: contents" },
  template: `<button fluidboxPrevious></button><button fluidboxNext></button
    ><button fluidboxClose></button>
    @if (zoom) {
      <div data-fluidbox-zoom-controls role="group" [attr.aria-label]="label()">
        <button fluidboxZoomIn></button><button fluidboxZoomOut></button
        ><button fluidboxZoomReset></button>
      </div>
    }`,
})
export class FluidboxControlsComponent {
  /** Add the zoom-in, zoom-out and fit controls, in their group. */
  @Input({ transform: booleanAttribute }) zoom = false;
  readonly #root = injectRoot("fluidboxControls");
  protected readonly label = computed(() => this.#root.resolvedLabels().zoomed);
}
