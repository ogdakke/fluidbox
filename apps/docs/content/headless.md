---
title: Headless runtime
section: Guides
order: 2
---

# Headless runtime

`createFluidbox()` runs the viewer without custom elements or a framework. You own the thumbnails and any controls; the runtime owns motion, gestures, focus, and the body-level portal.

## Create a viewer

```ts
import { arraySource, createFluidbox } from "@ogdakke/fluidbox";
import "@ogdakke/fluidbox/styles.css";

const source = arraySource([
  {
    id: "photo-1",
    media: {
      type: "image",
      src: "/full/photo-1.jpg",
      alt: "A footpath",
      width: 2400,
      height: 1600,
    },
    thumbnail: { src: "/thumb/photo-1.jpg", width: 480, height: 320 },
  },
]);

const viewer = createFluidbox({
  source,
  origins: {
    getOrigin(id) {
      const trigger = document.querySelector<HTMLElement>(`[data-photo-id="${id}"]`);
      const thumbnail = trigger?.querySelector("img") ?? undefined;
      return trigger ? { trigger, visual: trigger, thumbnail } : null;
    },
  },
});

for (const trigger of document.querySelectorAll<HTMLElement>("[data-photo-id]")) {
  trigger.addEventListener("click", () => void viewer.open({ id: trigger.dataset.photoId! }));
}
```

Importing the package is safe on the server. Calling `createFluidbox()` needs a DOM.

## Bring your own controls

A portal renderer mounts once into a stable target inside the viewer. It receives the controller and a lifetime signal, and may return a disposer.

```ts
const viewer = createFluidbox({
  source,
  origins,
  portal: {
    mount({ target, controller, signal }) {
      const bar = document.createElement("div");
      bar.className = "caption-bar";
      const counter = document.createElement("span");
      const close = document.createElement("button");
      close.textContent = "Close";
      close.addEventListener("click", () => void controller.close(), { signal });
      bar.append(counter, close);
      target.append(bar);

      const dispose = controller.subscribe((state) => {
        counter.textContent =
          state.activeIndex === null ? "" : `${state.activeIndex + 1} / ${state.count}`;
      });
      return () => {
        dispose();
        bar.remove();
      };
    },
  },
});
```

State updates are discrete snapshots. Per-frame motion stays in CSS variables, so subscribers never run on every animation frame.

## Guard and observe commands

```ts
createFluidbox({
  source,
  onBeforeCommand(event) {
    if (event.command === "close" && formIsDirty) event.preventDefault();
  },
  onEvent(event) {
    if (event.type === "selection-settle") analytics.record(event.id);
  },
});
```

## Reduce opening latency

`prepare(target)` mounts and measures the viewer on pointer down so the click opens without a layout pass. Dispose it if the press is cancelled.

```ts
trigger.addEventListener("pointerdown", (event) => {
  if (event.button !== 0) return;
  const cancel = viewer.prepare({ id });
  trigger.addEventListener("pointercancel", cancel, { once: true });
});
```

## Clean up

`destroy()` is synchronous and idempotent. It closes the viewer immediately, removes the portal, and leaves no command pending.

Continue with [Sources and origins](./sources-and-origins.md) for large collections, or the [API reference](./api.md).
