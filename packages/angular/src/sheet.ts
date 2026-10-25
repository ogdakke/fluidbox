import {
  ApplicationRef,
  Directive,
  NgZone,
  TemplateRef,
  inject,
  input,
  output,
  type OnChanges,
  type OnDestroy,
  type OnInit,
} from "@angular/core";
import type {
  FluidboxItem,
  FluidboxRenderer,
  FluidboxSheetEvent,
  FluidboxSheetSnapPoint,
} from "@ogdakke/fluidbox";
import { mountView, type FluidboxItemContext } from "./mount.js";
import { injectRoot, internalsOf, type FluidboxSheetPart } from "./root.js";

/**
 * Turns on a sheet over the photo, and fills the viewer's
 * `<section data-fluidbox-sheet>` for the active item. Needs
 * `@ogdakke/fluidbox/sheet.css`. Read and move the sheet with
 * `injectFluidboxSheet()`, or with a `fluidboxSheetSnap` button.
 *
 * ```html
 * <ng-template fluidboxSheet [snapPoints]="['40%', '90%']" let-item>…</ng-template>
 * ```
 */
@Directive({ selector: "ng-template[fluidboxSheet]", standalone: true })
export class FluidboxSheetDirective<TItem extends FluidboxItem = FluidboxItem>
  implements FluidboxSheetPart<TItem>, OnChanges, OnInit, OnDestroy
{
  /** The snaps above the resting one, lowest first. @default ["60%", "content"] */
  readonly snapPoints = input<readonly FluidboxSheetSnapPoint[]>();
  /** What a swipe down on the photo does with the sheet down. @default "flight" */
  readonly dismissMotion = input<"flight" | "scroll">();
  /** When the sheet comes to rest at another snap. */
  readonly snapChange = output<FluidboxSheetEvent>();

  readonly #root = injectRoot<TItem>("fluidboxSheet");
  readonly #template = inject<TemplateRef<FluidboxItemContext<TItem>>>(TemplateRef);
  readonly #zone = inject(NgZone);
  readonly #app = inject(ApplicationRef);
  readonly #events = new AbortController();
  #disconnect: (() => void) | undefined;

  /** Fills the sheet for the active item. */
  readonly render: FluidboxRenderer<TItem> = ({ item, index, target }) =>
    mountView(this.#zone, this.#app, this.#template, { $implicit: item, item, index }, target)
      .dispose;

  static ngTemplateContextGuard<TItem extends FluidboxItem>(
    _directive: FluidboxSheetDirective<TItem>,
    _context: unknown,
  ): _context is FluidboxItemContext<TItem> {
    return true;
  }

  ngOnChanges(): void {
    internalsOf(this.#root).schedule();
  }

  ngOnInit(): void {
    this.#root.fluidbox.addEventListener(
      "sheetchange",
      (event) => this.#zone.run(() => this.snapChange.emit(event)),
      { signal: this.#events.signal },
    );
    this.#disconnect = internalsOf(this.#root).connect("sheet", this);
  }

  ngOnDestroy(): void {
    this.#events.abort();
    this.#disconnect?.();
  }
}
