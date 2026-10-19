import {
  Directive,
  NgZone,
  TemplateRef,
  ViewContainerRef,
  inject,
  type OnDestroy,
  type OnInit,
} from "@angular/core";
import type { FluidboxItem } from "@ogdakke/fluidbox";
import { mountContent, type FluidboxItemContext } from "./mount.js";
import { injectRoot } from "./root.js";

/**
 * Turns on the viewer's thumbnail strip. On an `ng-container` it shows the
 * default thumbnails; on an `ng-template`, the template fills each thumbnail
 * button. The strip marks the selected button `data-fluidbox-selected`.
 *
 * ```html
 * <ng-container fluidboxFilmstrip />
 * <ng-template fluidboxFilmstrip let-item let-index="index">{{ index + 1 }}</ng-template>
 * ```
 */
@Directive({ selector: "[fluidboxFilmstrip]", standalone: true })
export class FluidboxFilmstripDirective<TItem extends FluidboxItem = FluidboxItem>
  implements OnInit, OnDestroy
{
  readonly #root = injectRoot<TItem>("fluidboxFilmstrip");
  readonly #template = inject<TemplateRef<FluidboxItemContext<TItem>>>(TemplateRef, {
    optional: true,
  });
  readonly #container = inject(ViewContainerRef);
  readonly #zone = inject(NgZone);
  #disconnect: (() => void) | undefined;

  static ngTemplateContextGuard<TItem extends FluidboxItem>(
    _directive: FluidboxFilmstripDirective<TItem>,
    _context: unknown,
  ): _context is FluidboxItemContext<TItem> {
    return true;
  }

  ngOnInit(): void {
    const template = this.#template;
    this.#disconnect = this.#root.connect("filmstrip", {
      render: template
        ? ({ item, index, target }) =>
            mountContent(this.#zone, this.#container, template, item, index, target)
        : null,
    });
  }

  ngOnDestroy(): void {
    this.#disconnect?.();
  }
}
