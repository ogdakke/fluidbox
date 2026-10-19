import {
  PLATFORM_ID,
  inject,
  reflectComponentType,
  type NgZone,
  type TemplateRef,
  type Type,
  type ViewContainerRef,
} from "@angular/core";
import type { FluidboxItem } from "@ogdakke/fluidbox";

/** The context of an item template: `let-item let-index="index"`. */
export interface FluidboxItemContext<TItem extends FluidboxItem = FluidboxItem> {
  $implicit: TItem;
  item: TItem;
  index: number;
}

/**
 * What draws an item: a template with `let-item let-index="index"`, or a
 * component, which gets `item` and `index` inputs when it declares them.
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
 * nodes out of the target again.
 */
export function mountTemplate<C>(
  zone: NgZone,
  container: ViewContainerRef,
  template: TemplateRef<C>,
  context: C,
  target: Element,
): () => void {
  return zone.run(() => {
    const view = container.createEmbeddedView(template, context);
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
): () => void {
  if (typeof content !== "function") {
    return mountTemplate(zone, container, content, { $implicit: item, item, index }, target);
  }
  return zone.run(() => {
    const component = container.createComponent(content);
    const inputs = reflectComponentType(content)?.inputs ?? [];
    const declares = (name: string) => inputs.some((input) => input.templateName === name);
    if (declares("item")) component.setInput("item", item);
    if (declares("index")) component.setInput("index", index);
    component.changeDetectorRef.detectChanges();
    target.append(component.location.nativeElement as Node);
    return () => zone.run(() => component.destroy());
  });
}
