/** Resolve the explicitly marked visual handoff box for a trigger. */
export function markedVisualOrigin(trigger: HTMLElement): HTMLElement | null {
  if (trigger.matches("[data-fluidbox-target]")) return trigger;
  const target = trigger.querySelector<HTMLElement>("[data-fluidbox-target]");
  if (target) return target;
  if (trigger.matches("[data-fluidbox-preview]")) return trigger;
  return trigger.querySelector<HTMLElement>("[data-fluidbox-preview]");
}

/**
 * Check whether an origin intersects the window and every clipping ancestor.
 * Shadow hosts participate in the same walk.
 */
export function originIsVisible(element: HTMLElement): boolean {
  const bounds = element.getBoundingClientRect();
  let left = Math.max(0, bounds.left);
  let top = Math.max(0, bounds.top);
  let right = Math.min(window.innerWidth, bounds.right);
  let bottom = Math.min(window.innerHeight, bounds.bottom);
  for (let ancestor: Element | null = element.parentElement; ancestor; ) {
    const style = getComputedStyle(ancestor);
    const clipX = style.overflowX !== "visible";
    const clipY = style.overflowY !== "visible";
    if (clipX || clipY) {
      const clip = ancestor.getBoundingClientRect();
      if (clipX) {
        left = Math.max(left, clip.left);
        right = Math.min(right, clip.right);
      }
      if (clipY) {
        top = Math.max(top, clip.top);
        bottom = Math.min(bottom, clip.bottom);
      }
    }
    const root = ancestor.getRootNode();
    ancestor = ancestor.parentElement ?? (root instanceof ShadowRoot ? root.host : null);
  }
  return right > left && bottom > top;
}
