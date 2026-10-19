import {
  ChangeDetectorRef,
  Component,
  Directive,
  ElementRef,
  Input,
  NgZone,
  Renderer2,
  TemplateRef,
  ViewContainerRef,
  booleanAttribute,
  computed,
  inject,
  numberAttribute,
  signal,
  type AfterContentInit,
  type DoCheck,
  type OnDestroy,
  type OnInit,
  type Signal,
} from "@angular/core";
import type { FluidboxControlName, FluidboxItem, FluidboxTarget } from "@ogdakke/fluidbox";
import {
  createTrigger,
  fluidboxControlIcon,
  fluidboxControls,
  idOf,
  type FluidboxTriggerPreview,
} from "@ogdakke/fluidbox/kit";
import { injectIsBrowser, mountTemplate } from "./mount.js";
import { injectRoot } from "./root.js";

/** An item, or its index or id. */
export type FluidboxItemRef<TItem extends FluidboxItem = FluidboxItem> = TItem | FluidboxTarget;

const targetOf = (value: FluidboxItemRef): FluidboxTarget =>
  typeof value === "object" ? idOf(value) : value;

const sameTargets = (a: readonly FluidboxTarget[], b: readonly FluidboxTarget[]) =>
  a.length === b.length && a.every((target, index) => target === b[index]);

/** Scopes an item for the triggers and overlays inside: the item, or its index or id. */
@Directive({ selector: "[fluidboxItem]", standalone: true })
export class FluidboxItemDirective<TItem extends FluidboxItem = FluidboxItem> {
  @Input({ required: true }) fluidboxItem!: FluidboxItemRef<TItem>;
}

/**
 * Opens an item, on any element. The element is registered as the origin of
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
  /** The item opened, or its index or id. Defaults to the first of `fluidboxTriggerItems`, then the enclosing `fluidboxItem`. */
  @Input() fluidboxTrigger?: FluidboxItemRef<TItem> | null;
  /** Every item that may return to this trigger on close, as for an album cover. */
  @Input() fluidboxTriggerItems?: readonly FluidboxItemRef<TItem>[];

  readonly #root = injectRoot<TItem>("fluidboxTrigger");
  readonly #item = inject(FluidboxItemDirective, { optional: true });
  readonly #element = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly #renderer = inject(Renderer2);
  readonly #changes = inject(ChangeDetectorRef);
  readonly #browser = injectIsBrowser();
  readonly #targets = signal<readonly FluidboxTarget[]>([], { equal: sameTargets });
  /** The opened item first, then the rest that may return here. */
  readonly targets: Signal<readonly FluidboxTarget[]> = this.#targets.asReadonly();
  readonly #previewChanges = signal(0);
  #followsPreview = false;
  readonly #trigger = createTrigger<TItem>(this.#root.fluidbox, {
    targets: [],
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
    const state = this.#root.state();
    return this.#targets().length
      ? this.#trigger.preview(state)
      : { item: null, index: null, status: "closed" };
  });
  #cleanup: (() => void)[] = [];

  ngDoCheck(): void {
    // The bare attribute binds "".
    const own = this.fluidboxTrigger === "" ? null : this.fluidboxTrigger;
    const first = own ?? this.fluidboxTriggerItems?.[0] ?? this.#item?.fluidboxItem;
    if (first === undefined || first === null)
      throw new Error("fluidboxTrigger needs an item, fluidboxTriggerItems, or a fluidboxItem.");
    const targets = [
      ...new Set([first, ...(this.fluidboxTriggerItems ?? [])].map((each) => targetOf(each))),
    ];
    if (sameTargets(targets, this.#targets())) return;
    this.#targets.set(targets);
    this.#trigger.update({ targets, onPreviewChange: () => this.#previewChanged() });
  }

  ngOnInit(): void {
    this.ngDoCheck();
    if (!this.#browser) return;
    const element = this.#element.nativeElement;
    const listen = (name: string, handler: (event: PointerEvent & MouseEvent) => void) =>
      this.#cleanup.push(this.#renderer.listen(element, name, handler));
    listen("pointerdown", (event) => this.#trigger.pointerDown(event));
    listen("pointerup", () => this.#trigger.pointerUp());
    listen("pointercancel", () => this.#trigger.pointerCancel());
    listen("click", (event) => this.#trigger.click(event));
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

/**
 * A badge or caption on a thumbnail, such as a count, that fades as the photo
 * leaves and returns. With `travel`, a copy of it flies with the photo. It
 * belongs to the enclosing trigger's items, else the enclosing `fluidboxItem`.
 */
@Directive({ selector: "[fluidboxThumbnailOverlay]", standalone: true })
export class FluidboxThumbnailOverlayDirective implements DoCheck, OnInit, OnDestroy {
  /** Fly with the photo. */
  @Input({ transform: booleanAttribute }) travel = false;

  readonly #root = injectRoot("fluidboxThumbnailOverlay");
  readonly #trigger = inject(FluidboxTriggerDirective, { optional: true });
  readonly #item = inject(FluidboxItemDirective, { optional: true });
  readonly #element = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly #browser = injectIsBrowser();
  #bound: readonly unknown[] = [];
  #release: (() => void) | undefined;
  #stop: (() => void) | undefined;

  ngOnInit(): void {
    if (!this.#browser) return;
    this.#bind();
    this.#stop = this.#root.watch(() => this.#bind());
  }

  ngDoCheck(): void {
    if (this.#stop) this.#bind();
  }

  ngOnDestroy(): void {
    this.#stop?.();
    this.#release?.();
  }

  #bind(): void {
    const targets =
      this.#trigger?.targets() ?? (this.#item ? [targetOf(this.#item.fluidboxItem)] : null);
    if (!targets)
      throw new Error(
        "fluidboxThumbnailOverlay needs an enclosing fluidboxTrigger or fluidboxItem.",
      );
    // Overlays are found by id when they bind, so new items bind them again.
    const key = [this.travel, this.#root.fluidbox.items, ...targets];
    if (key.length === this.#bound.length && key.every((value, i) => value === this.#bound[i]))
      return;
    this.#bound = key;
    this.#release?.();
    this.#release = this.#root.fluidbox.bindOverlay(this.#element.nativeElement, targets, {
      travel: this.travel,
    });
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

  ngOnInit(): void {
    this.#disconnect = this.#root.connect("viewer", {
      mount: (target) => mountTemplate(this.#zone, this.#container, this.#template, {}, target),
    });
  }

  ngOnDestroy(): void {
    this.#disconnect?.();
  }
}

/** Moves the sheet to a stop when clicked, in the viewer or in the sheet. */
@Directive({
  selector: "button[fluidboxSheetStop]",
  standalone: true,
  host: { "[attr.data-fluidbox-sheet-stop]": "fluidboxSheetStop", type: "button" },
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
  readonly isDisabled = computed(() => fluidboxControls[this.control].disabled(this.#root.state()));
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

/**
 * The default Previous, Next and Close buttons, for a `fluidboxViewer`
 * template: `<div fluidboxControls></div>`. Its element takes no box.
 */
@Component({
  selector: "[fluidboxControls]",
  standalone: true,
  imports: [FluidboxPreviousDirective, FluidboxNextDirective, FluidboxCloseDirective],
  host: { style: "display: contents" },
  template: `<button fluidboxPrevious></button><button fluidboxNext></button
    ><button fluidboxClose></button>`,
})
export class FluidboxControlsComponent {}
