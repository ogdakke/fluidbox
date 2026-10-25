import {
  ApplicationRef,
  Directive,
  NgZone,
  TemplateRef,
  inject,
  type OnDestroy,
  type OnInit,
} from "@angular/core";
import type { FluidboxItem } from "@ogdakke/fluidbox";
import { mountView, type FluidboxItemContext } from "./mount.js";
import { injectRoot, internalsOf } from "./root.js";

/** What a thumbnail's template gets: its item, and whether it is the one on show. */
export interface FluidboxThumbnailContext<
  TItem extends FluidboxItem = FluidboxItem,
> extends FluidboxItemContext<TItem> {
  active: boolean;
}

/**
 * Turns on the viewer's thumbnails. On an `ng-container` it shows the default
 * images; on an `ng-template`, the template fills each thumbnail button. The
 * button on show has `data-active`.
 *
 * ```html
 * <ng-container fluidboxThumbnails />
 * <ng-template fluidboxThumbnails let-index="index" let-active="active">{{ index + 1 }}</ng-template>
 * ```
 */
@Directive({ selector: "[fluidboxThumbnails]", standalone: true })
export class FluidboxThumbnailsDirective<TItem extends FluidboxItem = FluidboxItem>
  implements OnInit, OnDestroy
{
  readonly #root = injectRoot<TItem>("fluidboxThumbnails");
  readonly #template = inject<TemplateRef<FluidboxThumbnailContext<TItem>>>(TemplateRef, {
    optional: true,
  });
  readonly #zone = inject(NgZone);
  readonly #app = inject(ApplicationRef);
  #disconnect: (() => void) | undefined;

  static ngTemplateContextGuard<TItem extends FluidboxItem>(
    _directive: FluidboxThumbnailsDirective<TItem>,
    _context: unknown,
  ): _context is FluidboxThumbnailContext<TItem> {
    return true;
  }

  ngOnInit(): void {
    const template = this.#template;
    const root = this.#root;
    this.#disconnect = internalsOf(root).connect("thumbnails", {
      render: template
        ? ({ item, index, target }) => {
            const shown = () => root.fluidbox.state.index === index;
            const context = { $implicit: item, item, index, active: shown() };
            const mounted = mountView(this.#zone, this.#app, template, context, target);
            // The thumbnail on show follows the viewer.
            const stop = internalsOf(root).watch(() => {
              if (context.active === shown()) return;
              context.active = shown();
              mounted.check();
            });
            return () => {
              stop();
              mounted.dispose();
            };
          }
        : null,
    });
  }

  ngOnDestroy(): void {
    this.#disconnect?.();
  }
}
