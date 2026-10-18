---
title: React
section: Frameworks
order: 1
---

# React

`@ogdakke/fluidbox/react` composes the runtime from parts. It does not register custom elements.

## A gallery

```tsx
import { Lightbox } from "@ogdakke/fluidbox/react";
import "@ogdakke/fluidbox/styles.css";

export function Photos({ photos }: { photos: LightboxItem[] }) {
  return (
    <Lightbox.Root items={photos}>
      {photos.map((photo) => (
        <Lightbox.Item key={photo.id} id={photo.id}>
          <Lightbox.Trigger asChild>
            <button type="button">
              <img src={photo.thumbnail?.src} alt="" />
            </button>
          </Lightbox.Trigger>
        </Lightbox.Item>
      ))}
      <Lightbox.Portal>
        <Lightbox.Previous />
        <Lightbox.Next />
        <Lightbox.Close />
        <Lightbox.Filmstrip />
      </Lightbox.Portal>
    </Lightbox.Root>
  );
}
```

`Root` takes either `items` (an array) or `source` (a [`LightboxSource`](./sources-and-origins.md)), plus optional `origins`, `renderers`, `onBeforeCommand`, and `onEvent`.

## Parts

| Part                                 | Role                                                                                  |
| ------------------------------------ | ------------------------------------------------------------------------------------- |
| `Lightbox.Root`                      | Creates the controller for its items or source.                                       |
| `Lightbox.Item`                      | Scopes an item ID for the parts inside it.                                            |
| `Lightbox.Trigger`                   | Opens an item. `asChild` composes onto your element and its ref.                      |
| `Lightbox.ThumbnailOverlay`          | Content over the thumbnail that fades (`host`) or travels (`travel`) with the flight. |
| `Lightbox.Portal`                    | Renders children into the viewer's portal.                                            |
| `Lightbox.Previous`, `Next`, `Close` | Buttons wired to the controller, disabled at the ends of finite galleries.            |
| `Lightbox.Filmstrip`                 | The thumbnail strip.                                                                  |

Hooks: `useLightbox()` returns the controller; `useLightboxState(selector)` subscribes to a slice of state.

## Rich origins

Any element can be the origin. Mark the visible box with `data-lightbox-origin` when the trigger contains more than the image:

```tsx
<Lightbox.Trigger item={product} asChild>
  <button type="button" className="product">
    <span className="product__image" data-lightbox-origin>
      <img src="/runner.svg" alt="" />
      <Lightbox.ThumbnailOverlay behavior="travel">
        <span className="badge">New color</span>
      </Lightbox.ThumbnailOverlay>
    </span>
    <span className="product__details">Coral Runner · $124</span>
  </button>
</Lightbox.Trigger>
```

Only the image flies; the price stays on the card, and the badge rides along on the transition layer.

## One trigger, many slides

A trigger with `items` stands in for all of them. Its render callback receives the selected item, so the cover can follow navigation and every slide closes back to it:

```tsx
<Lightbox.Root items={photos}>
  <Lightbox.Trigger item={photos[0]} items={photos} asChild>
    {({ item }) => (
      <button type="button" aria-label="Open the album">
        <span data-lightbox-origin>
          <img src={item?.thumbnail?.src} alt="" />
          <Lightbox.ThumbnailOverlay>+{photos.length - 1}</Lightbox.ThumbnailOverlay>
        </span>
      </button>
    )}
  </Lightbox.Trigger>
  <Lightbox.Portal>
    <Lightbox.Close />
  </Lightbox.Portal>
</Lightbox.Root>
```

Keep the visual node mounted while its contents change so the handoff geometry stays stable.

## Virtualized lists

Pass a stable `source` and an `origins` adapter whose `revealOrigin` scrolls your virtualizer. The [React examples](https://fluidbox.local/react/) embed a 10,000-photo TanStack Virtual grid; [Sources and origins](./sources-and-origins.md) explains the contract.
