import {
  PLATFORM_ID,
  inject,
  reflectComponentType,
  type Injector,
  type NgZone,
  type TemplateRef,
  type Type,
  type ViewContainerRef,
} from "@angular/core";
import type { FluidboxItem, FluidboxSlideRenderContext } from "@ogdakke/fluidbox";

/**
 * What the sheet's and the filmstrip's templates get: `{ item, index }`, with
 * the item also as `$implicit`, so `let-item let-index="index"`.
 */
export interface FluidboxItemContext<TItem extends FluidboxItem = FluidboxItem> {
  $implicit: TItem;
  item: TItem;
  index: number;
  /**
   * In a custom slide, whether the slide is the one on show, kept up to date,
   * as `let-active="active"`.
   */
  active?: boolean;
}

/**
 * What draws an item: a template with `let-item let-index="index"`, or a
 * component, which gets `item` and `index` inputs when it declares them, and
 * in a custom slide `active`.
 */
export type FluidboxContent<TItem extends FluidboxItem = FluidboxItem> =
  | TemplateRef<FluidboxItemContext<TItem>>
  | Type<unknown>;

/** True in the browser, false while rendering on the server. */
export function injectIsBrowser(): boolean {
  return inject(PLATFORM_ID) === "browser";
}

/**
 * Render a template in a container, so it keeps the container's injector and
 * change detection, then move its nodes into a runtime target. Angular always
 * inserts a container's views before its anchor, so a view whose nodes moved
 * away never gets in the way of the next one. Destroying the view takes its
 * nodes out of the target again. An `injector` adds providers for the view.
 */
export function mountTemplate<C>(
  zone: NgZone,
  container: ViewContainerRef,
  template: TemplateRef<C>,
  context: C,
  target: Element,
  injector?: Injector,
): () => void {
  return zone.run(() => {
    const view = container.createEmbeddedView(template, context, { injector });
    view.detectChanges();
    target.append(...(view.rootNodes as Node[]));
    return () => zone.run(() => view.destroy());
  });
}

/** Render an item's template or component into a runtime target. */
export function mountContent<TItem extends FluidboxItem>(
  zone: NgZone,
  container: ViewContainerRef,
  content: FluidboxContent<TItem>,
  item: TItem,
  index: number,
  target: Element,
  slide?: FluidboxSlideRenderContext<TItem>,
): () => void {
  if (typeof content !== "function") {
    if (!slide) {
      return mountTemplate(zone, container, content, { $implicit: item, item, index }, target);
    }
    return zone.run(() => {
      const context = { $implicit: item, item, index, active: slide.active };
      const view = container.createEmbeddedView(content, context);
      view.detectChanges();
      target.append(...(view.rootNodes as Node[]));
      // The view reads its context object, so a change shows once it is checked.
      const stop = slide.onActiveChange((active) =>
        zone.run(() => {
          context.active = active;
          view.detectChanges();
        }),
      );
      return () => {
        stop();
        zone.run(() => view.destroy());
      };
    });
  }
  return zone.run(() => {
    const component = container.createComponent(content);
    const inputs = reflectComponentType(content)?.inputs ?? [];
    const declares = (name: string) => inputs.some((input) => input.templateName === name);
    if (declares("item")) component.setInput("item", item);
    if (declares("index")) component.setInput("index", index);
    const stop =
      slide && declares("active")
        ? (component.setInput("active", slide.active),
          slide.onActiveChange((active) =>
            zone.run(() => {
              component.setInput("active", active);
              component.changeDetectorRef.detectChanges();
            }),
          ))
        : undefined;
    component.changeDetectorRef.detectChanges();
    target.append(component.location.nativeElement as Node);
    return () => {
      stop?.();
      zone.run(() => component.destroy());
    };
  });
}
