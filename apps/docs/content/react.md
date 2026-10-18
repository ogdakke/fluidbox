---
title: React
section: Frameworks
order: 1
---

# React

`@ogdakke/fluidbox/react` composes the runtime from parts. It does not register custom elements.

## A gallery

```tsx
import { Fluidbox } from "@ogdakke/fluidbox/react";
import "@ogdakke/fluidbox/styles.css";

export function Photos({ photos }: { photos: FluidboxItem[] }) {
  return (
    <Fluidbox.Root items={photos}>
      {photos.map((photo) => (
        <Fluidbox.Item key={photo.id} id={photo.id}>
          <Fluidbox.Trigger asChild>
            <button type="button">
              <img src={photo.thumbnail?.src} alt="" />
            </button>
          </Fluidbox.Trigger>
        </Fluidbox.Item>
      ))}
      <Fluidbox.Portal>
        <Fluidbox.Previous />
        <Fluidbox.Next />
        <Fluidbox.Close />
        <Fluidbox.Filmstrip />
      </Fluidbox.Portal>
    </Fluidbox.Root>
  );
}
```

`Root` takes either `items` (an array) or `source` (a [`FluidboxSource`](./sources-and-origins.md)), plus optional `origins`, `renderers`, `onBeforeCommand`, and `onEvent`.

## Parts

| Part                                 | Role                                                                                  |
| ------------------------------------ | ------------------------------------------------------------------------------------- |
| `Fluidbox.Root`                      | Creates the controller for its items or source.                                       |
| `Fluidbox.Item`                      | Scopes an item ID for the parts inside it.                                            |
| `Fluidbox.Trigger`                   | Opens an item. `asChild` composes onto your element and its ref.                      |
| `Fluidbox.ThumbnailOverlay`          | Content over the thumbnail that fades (`host`) or travels (`travel`) with the flight. |
| `Fluidbox.Portal`                    | Renders children into the viewer's portal.                                            |
| `Fluidbox.Previous`, `Next`, `Close` | Buttons wired to the controller, disabled at the ends of finite galleries.            |
| `Fluidbox.Filmstrip`                 | The thumbnail strip.                                                                  |

Hooks: `useFluidbox()` returns the controller; `useFluidboxState(selector)` subscribes to a slice of state.

## Rich origins

Any element can be the origin. Mark the visible box with `data-fluidbox-origin` when the trigger contains more than the image:

```tsx
<Fluidbox.Trigger item={product} asChild>
  <button type="button" className="product">
    <span className="product__image" data-fluidbox-origin>
      <img src="/runner.svg" alt="" />
      <Fluidbox.ThumbnailOverlay behavior="travel">
        <span className="badge">New color</span>
      </Fluidbox.ThumbnailOverlay>
    </span>
    <span className="product__details">Coral Runner · $124</span>
  </button>
</Fluidbox.Trigger>
```

Only the image flies; the price stays on the card, and the badge rides along on the transition layer.

## One trigger, many slides

A trigger with `items` stands in for all of them. Its render callback receives the selected item, so the cover can follow navigation and every slide closes back to it:

```tsx
<Fluidbox.Root items={photos}>
  <Fluidbox.Trigger item={photos[0]} items={photos} asChild>
    {({ item }) => (
      <button type="button" aria-label="Open the album">
        <span data-fluidbox-origin>
          <img src={item?.thumbnail?.src} alt="" />
          <Fluidbox.ThumbnailOverlay>+{photos.length - 1}</Fluidbox.ThumbnailOverlay>
        </span>
      </button>
    )}
  </Fluidbox.Trigger>
  <Fluidbox.Portal>
    <Fluidbox.Close />
  </Fluidbox.Portal>
</Fluidbox.Root>
```

Keep the visual node mounted while its contents change so the handoff geometry stays stable.

## Virtualized lists

Pass a stable `source` and an `origins` adapter whose `revealOrigin` scrolls your virtualizer. The [React examples](https://fluidbox.local/react/) embed a 10,000-photo TanStack Virtual grid; [Sources and origins](./sources-and-origins.md) explains the contract.
