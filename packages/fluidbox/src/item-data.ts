import type { FluidboxItem } from "./public-api";

/** An item's `data` as attributes: `{ tone: "light" }` as `{ "data-tone": "light" }`. */
export function dataAttributes(data: FluidboxItem["data"]): Record<string, string> {
  const attributes: Record<string, string> = {};
  for (const [name, value] of Object.entries(data ?? {})) attributes[`data-${name}`] = value;
  return attributes;
}

/** The `data` names last put on each element, so the next item's take their place. */
const painted = new WeakMap<Element, readonly string[]>();

/** Put an item's `data` on an element, and take off what the item before it set. */
export function paintItemData(element: Element, data: FluidboxItem["data"]) {
  for (const name of painted.get(element) ?? []) element.removeAttribute(name);
  const attributes = dataAttributes(data);
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
  painted.set(element, Object.keys(attributes));
}
