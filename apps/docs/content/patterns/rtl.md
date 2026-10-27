---
title: Right to left
section: Patterns
order: 11
description: A gallery in an Arabic, right-to-left section, with the viewer's labels in Arabic.
---

# Right to left

The viewer sits at the end of `<body>`, outside your layout. When it opens, it copies the trigger's direction and the nearest `lang` onto itself, so a gallery inside `dir="rtl"` gets a right-to-left viewer even on a left-to-right page. There is no option to set.

<!-- pattern: rtl -->

- Forward is to the left. ArrowLeft and a swipe to the left go to the next item, Next sits on the left, and Close takes the top-left corner. The thumbnails start on the right.
- `labels` translates every word the viewer shows or announces. The example's `arabic` labels are in [the example data](./index.md#the-example-data). `position` is a function, so it can format numbers for the language.
- `lang` on the viewer makes a screen reader read the labels in that language.
- [Languages and direction](../languages.md) covers what flips, what doesn't, and wiring labels to an i18n library.
