import { expect, type Locator } from "@playwright/test";

/**
 * Wait until the viewer's code has loaded, for a fluidbox the page gives no
 * handle to. Until then a press only starts the load; once it is in, a press
 * prepares the viewer, so press and let go until one does.
 */
export async function viewerLoaded(trigger: Locator) {
  await trigger.hover();
  await expect
    .poll(() =>
      trigger.evaluate((element) => {
        const pointer = { bubbles: true, isPrimary: true, button: 0, pointerId: 1 };
        element.dispatchEvent(new PointerEvent("pointerdown", pointer));
        const prepared = !!document.querySelector("[data-fluidbox-prepared]");
        element.dispatchEvent(new PointerEvent("pointercancel", pointer));
        return prepared;
      }),
    )
    .toBe(true);
}
