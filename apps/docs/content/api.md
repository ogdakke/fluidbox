---
title: API reference
section: Reference
order: 1
---

# API reference

Everything below is exported from `@ogdakke/fluidbox` unless noted. Types live in the same entry.

## createFluidbox(options)

```ts
function createFluidbox<TItem extends FluidboxItem>(
  options: FluidboxOptions<TItem>,
): FluidboxController<TItem>;
```

| Option            | Type                                       | Notes                                                          |
| ----------------- | ------------------------------------------ | -------------------------------------------------------------- |
| `source`          | `FluidboxSource<TItem>`                    | Required. See [Sources and origins](./sources-and-origins.md). |
| `origins`         | `FluidboxOriginAdapter`                    | Resolves and reveals thumbnail elements.                       |
| `renderers`       | `Record<string, FluidboxRenderer>`         | Mounts `custom` media by renderer key.                         |
| `portal`          | `FluidboxPortalRenderer`                   | Mounts your controls into the viewer once.                     |
| `zoom`            | `false \| { step?: number; max?: number }` | `step` defaults to `2`, `max` to `4`. `false` disables zoom.   |
| `onBeforeCommand` | `(event) => void`                          | Runs synchronously; call `event.preventDefault()` to veto.     |
| `onEvent`         | `(event: FluidboxEvent) => void`           | Request, selection, and status events.                         |

## Controller

| Member                                                           | Description                                                                        |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `state`                                                          | Immutable `FluidboxState` snapshot.                                                |
| `prepare(target)`                                                | Mount and measure for a likely open. Returns a disposer.                           |
| `open(target, options?)`                                         | Open at `{ id }` or `{ index }`.                                                   |
| `close(options?)`                                                | Close to the current origin or the fallback.                                       |
| `goTo(target, options?)`, `next(options?)`, `previous(options?)` | Navigate while open.                                                               |
| `setSource(source)`                                              | Replace the source snapshot, keeping the active ID when possible.                  |
| `registerOrigin(id \| ids, origin)`                              | Register a mounted origin. Returns a disposer that removes only this registration. |
| `registerThumbnailOverlay(id, registration)`                     | Register a `host` or `travel` overlay. Returns a disposer.                         |
| `subscribe(listener)`                                            | Called after each new state snapshot. Returns a disposer.                          |
| `destroy()`                                                      | Synchronous and idempotent.                                                        |

`options` is `{ signal?: AbortSignal; reason?: FluidboxCommandReason }`. The default reason is `"api"`.

### Command results

Commands validate their target synchronously and throw `RangeError` for a missing or invalid one. Otherwise they resolve when the command settles:

| Result                             | Meaning                                                        |
| ---------------------------------- | -------------------------------------------------------------- |
| `{ status: "completed", changed }` | Settled. `changed` is false for an accepted no-op.             |
| `{ status: "superseded" }`         | A newer incompatible command took over from the painted pose.  |
| `{ status: "prevented" }`          | `onBeforeCommand` prevented it.                                |
| `{ status: "aborted" }`            | Its signal, a source replacement, or destruction cancelled it. |

### State

```ts
interface FluidboxState {
  status: "closed" | "opening" | "open" | "closing";
  count: number;
  activeId: string | null;
  activeIndex: number | null;
  requestedId: string | null;
  requestedIndex: number | null;
  canPrevious: boolean;
  canNext: boolean;
}
```

### Events

For an accepted open or navigation, events arrive in this order:

1. `onBeforeCommand` runs and may prevent the request.
2. `open-request` or `change-request`.
3. The requested ID and index enter state.
4. `selection-change` when the active item commits.
5. `selection-settle` after navigation and reveal scheduling settle.
6. The command resolves `completed`.

`status-change` reports `closed → opening → open` and `open → closing → closed`. Runtime input uses the reasons `trigger`, `keyboard`, `pointer`, `wheel`, and `filmstrip`; source reconciliation uses `source-update`, `source-empty`, and `teardown`.

## arraySource(items)

Builds an immutable `FluidboxSource` from an array. Throws for empty or duplicate IDs; an empty array is a valid empty source.

## Items

```ts
interface FluidboxItem {
  id: string;
  media: FluidboxImageMedia | FluidboxVideoMedia | FluidboxIframeMedia | FluidboxCustomMedia;
  thumbnail?: FluidboxImageResource;
  preview?: FluidboxImageResource;
  placeholder?: FluidboxImageResource;
  caption?: string;
  description?: string;
}
```

See [Media types](./media.md) for each media shape.

## Renderers

```ts
interface FluidboxRenderer<TItem> {
  mount(context: {
    item: TItem;
    index: number;
    target: HTMLElement;
    signal: AbortSignal;
  }): void | (() => void);
}

interface FluidboxPortalRenderer<TItem> {
  mount(context: {
    target: HTMLElement;
    controller: FluidboxController<TItem>;
    signal: AbortSignal;
  }): void | (() => void);
}
```

The runtime calls the returned disposer before it removes the target, and never reparents framework-owned nodes.

## Custom elements

| Export                       | Description                                                          |
| ---------------------------- | -------------------------------------------------------------------- |
| `registerFluidboxElements()` | Registers the elements. Use after hydration in server-rendered apps. |
| `FluidboxGalleryElement`     | `source`, `origins`, `controller`, `whenReady()`, `open(target)`.    |
| `FluidboxItemElement`        | `itemId`, `trigger`, `openItemId`.                                   |
| `@ogdakke/fluidbox/elements` | Side-effect import that registers on load.                           |
