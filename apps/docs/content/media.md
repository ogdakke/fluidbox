---
title: Media types
section: Guides
order: 4
---

# Media types

Images, video, iframes, and custom content share one slide strip, one set of gestures, and one transition model.

## Images

```ts
{
  type: "image",
  src: "/photo.jpg",
  alt: "A footpath through tall grass",
  width: 2400,
  height: 1600,
  candidates: [
    { src: "/photo-1200.jpg", width: 1200 },
    { src: "/photo-2400.jpg", width: 2400 },
  ],
  sizes: "100vw",
}
```

Loading is layered so the viewer never shows an empty frame:

1. `placeholder` paints immediately beneath everything.
2. The origin's decoded `thumbnail`, or the item's `preview`, covers it.
3. The browser-selected full image covers both once it has decoded.

The active image and its neighbours load eagerly. A failed full image keeps the preview visible and offers a retry.

## Video

```ts
{ type: "video", src: "/clip.mp4", title: "Harbour timelapse", width: 1920, height: 1080, poster: { src: "/clip.jpg" } }
```

Videos render with native controls. Closing animates the video inside its own frame so playback is never reset by moving the element.

## Iframes

```ts
{
  type: "iframe",
  src: "https://www.openstreetmap.org/export/embed.html?bbox=…",
  title: "Market Square on OpenStreetMap",
  width: 1000,
  height: 700,
  thumbnail: { src: "/map-preview.png" },
}
```

`allow`, `referrerPolicy`, and `sandbox` pass through to the element.

Embedded pages paint well after the opening motion starts. The runtime covers the frame with a snapshot until the iframe has loaded, then fades it away; on close it fades the snapshot back in so the frame lands on the card it came from. The snapshot is the item's `preview` or `thumbnail`, or the origin's thumbnail image.

> Give an iframe item a static preview that matches what the embed shows first. A screenshot or tile snapshot makes the handoff seamless.

## Custom content

Custom media names a renderer; the renderer mounts whatever you like into a stable target.

```ts
const viewer = createLightbox({
  source: arraySource([
    {
      id: "chart",
      media: {
        type: "custom",
        renderer: "chart",
        title: "Monthly visitors",
        width: 1200,
        height: 800,
      },
    },
  ]),
  renderers: {
    chart: {
      mount({ target, item, signal }) {
        const chart = drawChart(target, item.id);
        signal.addEventListener("abort", () => chart.stop(), { once: true });
        return () => chart.destroy();
      },
    },
  },
});
```

Custom slides outside the bounded window are disposed and remounted when revisited. Keep state you need to preserve in application state, not in the mounted nodes.
