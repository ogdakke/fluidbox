---
title: Next.js
section: Frameworks
order: 2
description: Fluidbox in Next.js through the React binding, with the gallery in a client component, the stylesheets in the root layout, next/image triggers, and getImageProps for the viewer's srcset. App Router and Pages Router.
---

# Next.js

Next.js uses the [React binding](./react.md), `@ogdakke/fluidbox/react`. The package has nothing specific to Next. This page shows where each piece goes, and how to feed the viewer from Next's image optimizer so it loads the size the screen needs. It was checked with Next.js 16.4 and React 19.3, with `next build` in Chromium, Firefox and WebKit and `next dev` in Chromium.

## Install

```bash
pnpm add @ogdakke/fluidbox
```

## The stylesheets

Import them once, in the root layout. A server component can import CSS. `styles.css` holds what makes the viewer work and draws no look of its own; `baseline.css` is the default look, which you can leave out to style the viewer yourself (see [Styling](./styling.md)). The thumbnails and the sheet each need their own stylesheet on top of the base one.

```tsx
// app/layout.tsx
import "@ogdakke/fluidbox/styles.css";
// Optional: the default look.
import "@ogdakke/fluidbox/baseline.css";
// Only with <Fluidbox.Thumbnails />:
import "@ogdakke/fluidbox/thumbnails.css";
// Only with <Fluidbox.Sheet>:
import "@ogdakke/fluidbox/sheet.css";
```

## The items, from the optimizer

`getImageProps` from `next/image` returns the props `<Image>` would render. Call it twice per photo, once at full-screen `sizes` for the viewer and once at the grid's `sizes` for the triggers, and hand both to `imageItem`:

```ts
// app/photos.ts
import { imageItem } from "@ogdakke/fluidbox";
import { getImageProps } from "next/image";
import valley from "./images/valley.webp";
import canyon from "./images/canyon.webp";

const files = [
  { slug: "valley", src: valley, alt: "River valley" },
  { slug: "canyon", src: canyon, alt: "Canyon" },
];

export const photos = files.map(({ slug, src, alt }) => {
  const image = { src, alt, placeholder: "blur" } as const;
  const full = getImageProps({ ...image, sizes: "100vw" });
  const thumb = getImageProps({
    ...image,
    sizes: "(min-width: 640px) 25vw, 50vw",
  });
  return {
    ...imageItem(full.props, thumb.props),
    id: slug,
    thumb: thumb.props,
  };
});

export type Photo = (typeof photos)[number];
```

- The viewer gets the full srcset, the thumbnail and Next's blur as the `placeholder`. The blur paints the moment a slide appears, under the thumbnail and the full image.
- `thumb` keeps the grid's props for the triggers to render, so the grid's `sizes` lives in one place. The viewer sees that the trigger already shows the thumbnail and flies the image the page has decoded.
- On a 1200 px screen the viewer loads the 1200w file, and the thumbnails takes the thumbnail's smallest candidate. `src` is the largest width, which only browsers without `srcset` load.
- A static import gives Next the width, the height and the blur. For a remote file, pass `width`, `height` and a `blurDataURL` of your own.
- The slug is the item's `id`, which triggers and `value` name it by. `thumb` is a [field of your own](./media.md#fields-of-your-own); the viewer hands it back in every state and callback.

## The gallery

The React parts use hooks, and `Fluidbox` is one object that a server component can't reach into. Put the gallery in a file that starts with `"use client"`, and give it the items as a prop.

```tsx
// app/gallery.tsx
"use client";

import { Fluidbox } from "@ogdakke/fluidbox/react";
import type { Photo } from "./photos";

export function Gallery({ photos }: { photos: Photo[] }) {
  return (
    <Fluidbox.Root items={photos}>
      <div className="grid">
        {photos.map((photo) => (
          <Fluidbox.Trigger key={photo.id} value={photo.id}>
            <img {...photo.thumb} />
          </Fluidbox.Trigger>
        ))}
      </div>
      <Fluidbox.Thumbnails />
    </Fluidbox.Root>
  );
}
```

```tsx
// app/page.tsx
import { Gallery } from "./gallery";
import { photos } from "./photos";

export default function Page() {
  return <Gallery photos={photos} />;
}
```

The items are plain objects, so they cross from the server component to the client one as props. The `<img>` renders what `<Image>` would, lazy loading and blur included. Next's `no-img-element` lint rule flags it, so turn the rule off for that line.

## Server rendering

The triggers render on the server as `<button>`s holding your images, so the grid is in the HTML before any JavaScript runs. `Root` makes the viewer in the browser after hydration, and its code loads when a pointer first hovers a trigger. [Loading the viewer](./getting-started.md#loading-the-viewer) has the other options. `next dev` runs React in StrictMode, which `Root` handles.

## Pages Router

The same `Gallery` works in `pages/`. Import the stylesheets in `pages/_app.tsx`, where the Pages Router takes global CSS, and build the items in `getStaticProps` or `getServerSideProps`:

```tsx
// pages/_app.tsx
import "@ogdakke/fluidbox/styles.css";
import "@ogdakke/fluidbox/baseline.css";
import "@ogdakke/fluidbox/thumbnails.css";
import "@ogdakke/fluidbox/sheet.css";
import type { AppProps } from "next/app";

export default function App({ Component, pageProps }: AppProps) {
  return <Component {...pageProps} />;
}
```

```tsx
// pages/photos.tsx
import { Gallery } from "../components/gallery";
import { photos, type Photo } from "../components/photos";

export function getStaticProps() {
  return { props: { photos } };
}

export default function Photos({ photos }: { photos: Photo[] }) {
  return <Gallery photos={photos} />;
}
```

## The open photo in the URL

With the App Router, read `?photo=` with `useSearchParams` and write it with the History API. Next.js folds `history.pushState` and `replaceState` into its router, so `useSearchParams` follows them, and the page doesn't fetch again as `router.push` would. The id is the item's own, so the link survives a reordering:

```tsx
// app/gallery.tsx
"use client";

import { Fluidbox } from "@ogdakke/fluidbox/react";
import { useSearchParams } from "next/navigation";
import type { Photo } from "./photos";

export function Gallery({ photos }: { photos: Photo[] }) {
  const id = useSearchParams().get("photo");
  // `?photo=canyon` opens that photo.
  const shown = photos.find((photo) => photo.id === id)?.id ?? null;

  return (
    <Fluidbox.Root
      items={photos}
      value={shown}
      onValueChange={(value) => {
        const url = new URL(location.href);
        if (value === null) {
          // Back past the entry the open added, or drop the photo from a link you came in on.
          if (history.state?.photo) return history.back();
          url.searchParams.delete("photo");
          return history.replaceState(null, "", url);
        }
        url.searchParams.set("photo", value);
        // Opening adds an entry, so Back closes the viewer; a move replaces it.
        if (shown === null) history.pushState({ photo: true }, "", url);
        else history.replaceState({ photo: true }, "", url);
      }}
    >
      <div className="grid">
        {photos.map((photo) => (
          <Fluidbox.Trigger key={photo.id} value={photo.id}>
            <img {...photo.thumb} />
          </Fluidbox.Trigger>
        ))}
      </div>
    </Fluidbox.Root>
  );
}
```

```tsx
// app/page.tsx
import { Suspense } from "react";
import { Gallery } from "./gallery";
import { photos } from "./photos";

export default function Page() {
  return (
    <Suspense>
      <Gallery photos={photos} />
    </Suspense>
  );
}
```

- A statically rendered page has no query on the server, so `useSearchParams` needs a `Suspense` boundary around the component that reads it. The grid renders on the server; the viewer opens on `?photo=` once the page hydrates, flying from its trigger.
- On a dynamically rendered page the server reads the query too, and a `value` that names an image renders the open viewer's copy in the HTML, which the viewer takes over without motion. Give Root `href` so the copy's controls link to the other photos before JavaScript runs.
- The [photo in the address](./patterns/url.md) pattern is the same without Next.js.

## A page per photo

Instagram-style galleries give each photo its own path. Opening one from the grid shows it in the viewer at `/photos/canyon`, and loading that path shows a page of its own, which a server can render with its own title and preview image. Next's intercepting routes build this with a modal route. The viewer already is the modal, so the gallery only has to write the path:

```tsx
// app/gallery.tsx
"use client";

import { Fluidbox } from "@ogdakke/fluidbox/react";
import { usePathname } from "next/navigation";
import type { Photo } from "./photos";

export function Gallery({ photos }: { photos: Photo[] }) {
  const photoAt = (path: string | null) =>
    photos.find(({ id }) => path === `/photos/${id}`)?.id ?? null;
  const shown = photoAt(usePathname());

  return (
    <Fluidbox.Root
      items={photos}
      value={shown}
      onValueChange={(value) => {
        const open = photoAt(location.pathname) !== null;
        if (value === null) {
          // Back to the grid, unless Back closed it already.
          if (open) history.back();
        } else if (open) {
          history.replaceState(null, "", `/photos/${value}`);
        } else {
          history.pushState(null, "", `/photos/${value}`);
        }
      }}
    >
      {/* The grid, as above */}
    </Fluidbox.Root>
  );
}
```

```tsx
// app/photos/[slug]/page.tsx
import { notFound } from "next/navigation";
import { photos } from "../../photos";

export function generateStaticParams() {
  return photos.map(({ id }) => ({ slug: id }));
}

type Props = { params: Promise<{ slug: string }> };

export default async function PhotoPage({ params }: Props) {
  const { slug } = await params;
  const photo = photos.find((each) => each.id === slug);
  if (!photo) notFound();
  return <img {...photo.thumb} sizes="100vw" />;
}
```

- `history.pushState` and `replaceState` update `usePathname` without a navigation, so the grid stays on screen under the viewer. Opening adds one entry, moving replaces it, and Back closes the viewer.
- A reload at `/photos/canyon` loads the photo's own page, not the grid.
