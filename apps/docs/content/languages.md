---
title: Languages and direction
section: Guides
order: 7
description: Translate the viewer's labels, use an i18n library, and run the viewer right to left.
---

# Languages and direction

The viewer has fifteen strings of its own: button names, the dialog's name, what it announces as it moves, what a screen reader calls the strip and its slides, and the error on a slide that failed to load. Everything else it shows comes from your items, such as `alt` and `title`. Fluidbox ships these strings in English and no other language. You pass your own through `labels`.

## Labels

`labels` takes any of the strings. The ones you leave out stay English. [Labels](./api.md#labels) in the API reference lists them all.

```ts
createFluidbox({
  items: photos,
  labels: {
    viewer: "Mediakatselin",
    close: "Sulje",
    previous: "Edellinen",
    next: "Seuraava",
    position: (index, count) => `Kuva ${index + 1}/${count}`,
  },
});
```

`position(index, count)` names each slide, and a filmstrip thumbnail whose item has no name. `announcement(name, index, count)` is what the viewer says as it moves, with the item's alt text or title as `name`; as it opens, the dialog's name already says that, so `name` is `""` there. `index` counts from 0. Because it's a function, you can format the numbers for the language with `Intl.NumberFormat`:

```ts
const number = new Intl.NumberFormat("ar-u-nu-arab");
const position = (index: number, count: number) =>
  `العنصر ${number.format(index + 1)} من ${number.format(count)}`;
```

Plain `"ar"` gives Western digits in current browsers, so the `-u-nu-arab` extension asks for Arabic-Indic ones.

## Changing language

New labels apply to an open viewer straight away. Each entry point takes them the same way it takes its other options:

- **Plain JavaScript:** `fluidbox.update({ labels })`.
- **Custom elements:** set the gallery's `labels` property.
- **React, Vue, Solid:** pass a new `labels` prop to `Root`. React and Vue compare labels by their strings, so an inline object on every render does nothing until a string changes.
- **Angular:** bind `[labels]` on `fluidboxRoot`.

With react-i18next, build the labels from `t` and pass them to `Root`:

```tsx
import { useTranslation } from "react-i18next";
import { Fluidbox } from "@ogdakke/fluidbox/react";

function Gallery() {
  const { t } = useTranslation();
  const labels = {
    close: t("viewer.close"),
    previous: t("viewer.previous"),
    next: t("viewer.next"),
    position: (index: number, count: number) => t("viewer.position", { index: index + 1, count }),
  };
  return (
    <Fluidbox.Root items={photos} labels={labels}>
      {/* … */}
    </Fluidbox.Root>
  );
}
```

With vue-i18n, a `computed` does the same:

```vue
<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { Fluidbox } from "@ogdakke/fluidbox/vue";

const { t } = useI18n();
const labels = computed(() => ({
  close: t("viewer.close"),
  previous: t("viewer.previous"),
  next: t("viewer.next"),
  position: (index: number, count: number) => t("viewer.position", { index: index + 1, count }),
}));
</script>

<template>
  <Fluidbox.Root :items="photos" :labels="labels"><!-- … --></Fluidbox.Root>
</template>
```

## Direction

The viewer is mounted at the end of `<body>`, so it can't inherit direction from your layout. When it opens, it reads the trigger's computed `direction` and the nearest `lang` attribute, and sets both on itself. Opened from code without a trigger, it reads them from the focused element, or else from the page. A gallery inside `dir="rtl"` gets a right-to-left viewer on any page, and the setting has no option of its own. A change of direction applies from the next open.

Right to left, these flip:

- ArrowLeft goes to the next item, and ArrowRight to the previous one.
- A swipe or trackpad scroll to the left goes forward. The slides are a native scroller, so this comes from the browser.
- Next sits on the left, Previous on the right, and their arrows point the other way. Close moves to the top-left corner.
- The filmstrip starts on the right, and its arrow keys follow. A vertical filmstrip sits on the right.

These stay the same:

- Zoom pans a picture, which has no reading direction.
- Dragging down closes the viewer, and the sheet rises from the bottom.

Your own controls and viewer content inherit the direction, so CSS logical properties such as `inset-inline-start` and `margin-inline-end` lay them out for both. [Right to left](./patterns/rtl.md) is the pattern in every framework.
