import {
  Directive,
  Input,
  NgZone,
  TemplateRef,
  ViewContainerRef,
  inject,
  type OnChanges,
  type OnDestroy,
  type OnInit,
} from "@angular/core";
import type { FluidboxItem, FluidboxRenderer, FluidboxSheetSnapPoint } from "@ogdakke/fluidbox";
import { mountContent, type FluidboxItemContext } from "./mount.js";
import { injectRoot, type FluidboxSheetPart } from "./root.js";

/**
 * Turns on a sheet over the photo, and fills it for the active item. Needs
 * `@ogdakke/fluidbox/sheet.css`. Read and move the sheet with
 * `injectFluidboxSheet()`, or with a `fluidboxSheetStop` button.
 *
 * ```html
 * <ng-template fluidboxSheet [snapPoints]="['40%', '90%']" let-item>…</ng-template>
 * ```
 */
@Directive({ selector: "ng-template[fluidboxSheet]", standalone: true })
export class FluidboxSheetDirective<TItem extends FluidboxItem = FluidboxItem>
  implements FluidboxSheetPart<TItem>, OnChanges, OnInit, OnDestroy
{
  /** The stops above the resting one, lowest first. @default ["60%", "content"] */
  @Input() snapPoints?: readonly FluidboxSheetSnapPoint[];
  /** What a swipe down on the photo does with the sheet down. @default "flight" */
  @Input() dismissMotion?: "flight" | "scroll";

  readonly #root = injectRoot<TItem>("fluidboxSheet");
  readonly #template = inject<TemplateRef<FluidboxItemContext<TItem>>>(TemplateRef);
  readonly #container = inject(ViewContainerRef);
  readonly #zone = inject(NgZone);
  #disconnect: (() => void) | undefined;

  /** Fills the sheet for the active item. */
  readonly render: FluidboxRenderer<TItem> = ({ item, index, target }) =>
    mountContent(this.#zone, this.#container, this.#template, item, index, target);

  static ngTemplateContextGuard<TItem extends FluidboxItem>(
    _directive: FluidboxSheetDirective<TItem>,
    _context: unknown,
  ): _context is FluidboxItemContext<TItem> {
    return true;
  }

  ngOnChanges(): void {
    this.#root.schedule();
  }

  ngOnInit(): void {
    this.#disconnect = this.#root.connect("sheet", this);
  }

  ngOnDestroy(): void {
    this.#disconnect?.();
  }
}
