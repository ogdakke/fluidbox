# 7. State, server rendering, lazy lists, labels

## 7.1 Controlled state and URL sync

### The model

`value` is the open item's id, or `null` when the viewer is closed. Every binding takes it in the
framework's usual controlled form:

| Framework | Controlled                                     | Uncontrolled start               | Change                                                                    |
| --------- | ---------------------------------------------- | -------------------------------- | ------------------------------------------------------------------------- |
| React     | `value`                                        | `defaultValue`                   | `onValueChange(value, details)`                                           |
| Vue       | `v-model` (`modelValue`)                       | `default-value`                  | `update:modelValue`, plus `@value-change(value, details)` for the details |
| Solid     | `value` (an accessor read in a tracking scope) | `defaultValue`                   | `onValueChange(value, details)`                                           |
| Angular   | `[(value)]` (a `model()` signal)               | `[defaultValue]`                 | `(valueChange)`, plus `(beforeValueChange)` with the event                |
| Elements  | `value` attribute and property                 | the attribute in the server HTML | `valuechange` event; `beforevaluechange` to cancel                        |
| Plain JS  | `value` option                                 | —                                | `beforevaluechange`, `valuechange`                                        |

Same rule as Base UI and Radix: when `value` is absent (`undefined`) the Root keeps its own state;
when present, even `null`, the Root follows it.

### A value is a request

A controlled `value` that differs from the viewer's asks the viewer to open, move or close to it,
the way `createFluidboxSync` acts on `open` and `index` now (`controlled.ts:21`). The viewer does
not refuse to move until the app writes `value` back. That is the choice §8.1 argues: the viewer
owns animation, focus and history of its own (Back, Escape, swipes in flight), and a strict lock
would make each of those wait one render. To refuse a change, cancel it:

```tsx
<Fluidbox.Root
  items={photos}
  value={photo}
  onValueChange={(next, details) => {
    if (unsaved && details.action === "close") return details.cancel();
    setPhoto(next);
  }}
/>
```

`onValueChange` is called from `beforevaluechange`, so `cancel()` keeps the viewer where it is and
no `valuechange` follows. The binding listens for `beforevaluechange` itself and passes the
details; it is the one before-listener a framework app needs.

The sync compares the incoming `value` against `fluidbox.state.value`, which already holds where
the viewer is going (`status: "opening"` with the new value). So the binding writing back the
value it was just told about does nothing, as now.

Edge cases, each with today's equivalent:

| Case                                                  | Behaviour                                                                                                                                                       |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `value` names no item                                 | Treated as `null`, with a dev warning. Today an out-of-range `index` is ignored (`controlled.ts:32`).                                                           |
| `value` set while the items change in the same render | The sync runs after `setItems`, as now (React: the effect order in `index.ts:415`).                                                                             |
| `value` changes while a flight runs                   | Retargets, as `open(index)` during an open does.                                                                                                                |
| `value` → `null` during an open                       | Closes from where the flight is.                                                                                                                                |
| App never writes `value` back                         | The viewer moves anyway; the next render with the old `value` moves it back. That is the controlled contract; the docs say "update `value` in `onValueChange`". |

### URL sync

§6.11 is the full example. In short, one handler replaces today's two:

```ts
// today: an open fires onOpenChange(true) and onIndexChange(i); a close fires onOpenChange(false)
// new: every change is one call
onValueChange={(value) => { followInUrl(value); setPhoto(value); }}
```

An id in the address (`?photo=fjord`) needs no lookup. The docs' URL page should show that form
first and the 1-based index as the variant, since an id survives reordering.

Next.js: the page-per-photo route (`nextjs.md:151-188`) passes `value={params.photo}` where the
slug is the id, and `onValueChange` calls `router.push` or `router.back()`. Today it converts the
slug to an index and back.

Vue Router and Angular Router read the same way: `v-model` bound to a computed over
`route.query.photo`; `[value]="photo()"` with `photo = toSignal(route.queryParamMap.pipe(map(…)))`
and `(valueChange)` calling `router.navigate([], { queryParams, queryParamsHandling: "merge" })`.
The spec adds one example per framework to the URL page.

## 7.2 Server rendering

### What stays

The server copy of the open viewer stays as it is: `fluidboxStaticViewer` and
`fluidboxStaticViewerNodes` (`static-viewer.ts:79`, `:235`), which the bindings render when the Root
is open on its first render (`react/src/index.ts:406-411`), and `takeOverFluidbox`
(`kit.ts:66`), which opens the live viewer over it without motion.

### What changes

| Today                                                              | New                                                                                                              |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| `FluidboxStaticViewerOptions.index`                                | `value: string`. The function finds the index itself.                                                            |
| `href: (index: number \| null) => string \| undefined`             | `href: (value: string \| null) => string \| undefined`. Previous gets the previous item's id, Close gets `null`. |
| `filmstrip?: boolean`                                              | `thumbnails?: boolean`                                                                                           |
| `takeOverFluidbox(fluidbox, element, index)`                       | `takeOverFluidbox(fluidbox, element, value)`                                                                     |
| The Root draws the copy when `open && items[index].type === "img"` | When `value` names an `"image"` item in an array.                                                                |
| `data-fluidbox-overlay` on the copy's root                         | `data-fluidbox-viewer`, as on the live viewer.                                                                   |

Only images get a server copy, as now (`static-viewer.ts:91`). A video, iframe or custom slide opens
after hydration; the trigger stays a link (`<a href>` trigger, `public-api.ts:651`) so the page works
without JavaScript.

### Custom slides on the server

A framework slide would render on the server naturally (it is a child of the Root), but the copy is
built from the item, not from the framework tree, and the takeover hides the copy and shows the live
viewer in the same frame. Rendering a framework slide twice, once in the copy and once live, would
double its effects. The spec keeps images-only and lists rendering `Slides` into the copy as later
work. The `Caption` part is the exception that costs nothing: it reads `item.caption`, so the copy
draws it from the item (`data-fluidbox-description` on the copy's slide).

### Lazy lists and the server

The copy needs the item at `value`. With an array the Root finds it; with a `FluidboxItemList` it
calls `indexOf(value)` then `get(index)`. Today the copy requires an array
(`Array.isArray(items)` at `react/src/index.ts:409`); the spec allows a list when it has
`indexOf`, since `createItemList` always does.

## 7.3 Lazy lists

`createItemList`, `FluidboxItemList` and `FluidboxItemListOptions` stay (`items.ts:97`). The changes
come from `value` being an id.

### Finding an index from a value

Every value change needs an index: the strip is indexed, `findTrigger` and `revealTrigger` get one,
and the counter shows it. `toList` keeps a map for arrays (`items.ts:140`). For a lazy list,
`indexOf` tries, in order, the ids it has made, the `index(id)` option, and a scan of every item
(`items.ts:113-122`). The scan makes each item to read its id, so a long list without `index`
would make all of them on the first `value` it doesn't know.

So:

- `createItemList` keeps `index` optional, but the docs show it in every lazy-list example, and in
  development the list warns once when a scan passes 1,000 items.
- An id that encodes the index (`photo-412`) is the common case; the example on
  `items-and-origins.md` uses `index: (id) => Number(id.slice(6))`.

Nothing else in the list changes. `FluidboxItemList.indexOf` stays optional in the type, so a list
written by hand without it still works, through `indexIn`'s scan (`items.ts:183`).

### Triggers in a virtualised page

`origins` becomes two options (§2.2, §1.3):

```ts
createFluidbox({
  items: photoList,
  // The trigger on the page now, or null if it is scrolled out and unmounted.
  findTrigger: (item) => grid.querySelector(`[data-photo="${item.id}"]`),
  // Scroll the item's trigger into view: before the opening flight, and as the viewer moves.
  revealTrigger: async (item, index, { signal }) => {
    virtualizer.scrollToIndex(index, { align: "center" });
    await nextFrame(signal);
  },
});
```

The bindings expose both on the Root (`findTrigger`, `revealTrigger` props; Angular inputs). A
mounted `Trigger` part registers itself and wins over `findTrigger`, as registered origins win over
the adapter today (`origin-registry.ts`). `revealTrigger` gets `{ signal, phase }` where `phase` is
`"open" | "selection"`, as `revealOrigin` has now (`public-api.ts:239`); the docs' `reason` on `origins.md:15` is a stale
name for the same field (§1.19).

## 7.4 Labels and i18n

### Keys

`FluidboxLabels` keeps its shape (`labels.ts:2`). Renamed and new keys:

| Today           | New                                 | Default                         |
| --------------- | ----------------------------------- | ------------------------------- |
| `filmstrip`     | `thumbnails`                        | `"Gallery thumbnails"`          |
| `filmstripList` | `thumbnailsList`                    | `"Choose a gallery item"`       |
| —               | `counter: (index, count) => string` | `` `${index + 1} / ${count}` `` |

`counter` is what `<Fluidbox.Counter>` shows. It is `aria-hidden`, because the dialog name and
`announcement` already say the position; `position` stays the accessible text of a slide and a
thumbnail.

The add-ons keep their strings as options (§4.2), not label keys: `Embed label`, `Spin label`.

### Where labels go

| Surface      | How                                                                       |
| ------------ | ------------------------------------------------------------------------- |
| Plain JS     | `labels` option; `update({ labels })`                                     |
| React, Solid | `labels` prop on Root                                                     |
| Vue          | `:labels` on Root                                                         |
| Angular      | `[labels]` on `fluidboxRoot`                                              |
| Elements     | `labels` property on `<fluidbox-gallery>`; `lang` and `dir` from the page |
| Server copy  | `labels` in `FluidboxStaticViewerOptions`                                 |

A part with children uses the children instead of the label: `<Fluidbox.Close>Schließen</Fluidbox.Close>`
names the button by its text; an icon-only part takes `aria-label`, which wins over the label.

### With react-i18next and vue-i18n

```tsx
import { useTranslation } from "react-i18next";

function Gallery() {
  const { t } = useTranslation("gallery");
  const labels = useMemo(
    () => ({
      close: t("close"),
      previous: t("previous"),
      next: t("next"),
      thumbnails: t("thumbnails"),
      counter: (index: number, count: number) => t("counter", { index: index + 1, count }),
      position: (index: number, count: number) => t("position", { index: index + 1, count }),
    }),
    [t],
  );
  return (
    <Fluidbox.Root items={photos} labels={labels}>
      …
    </Fluidbox.Root>
  );
}
```

```vue
<script setup lang="ts">
const { t } = useI18n();
const labels = computed(() => ({
  close: t("gallery.close"),
  thumbnails: t("gallery.thumbnails"),
  counter: (index: number, count: number) => t("gallery.counter", { index: index + 1, count }),
}));
</script>

<template>
  <Fluidbox.Root :items="photos" :labels="labels">…</Fluidbox.Root>
</template>
```

Changing `labels` updates the open viewer in place, as `update({ labels })` does now. The
`languages.md` examples (`:187-261`) need only the two renamed keys and the new `counter`.

### Direction

Unchanged: the viewer takes `dir` and `lang` from the trigger's surroundings (§6.10), Previous and
Next swap their arrows and keys in RTL, and the thumbnails' axis follows. `Counter` text is
plain, so an app that wants Arabic-Indic digits formats them in its `counter` function with
`Intl.NumberFormat`.
