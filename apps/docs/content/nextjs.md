---
title: Next.js
section: Frameworks
order: 2
description: Fluidbox in Next.js through the React binding, with the gallery in a client component, the stylesheets in the root layout, next/image triggers, and getImageProps for the viewer's srcset. App Router and Pages Router.
---

# Next.js

Next.js uses the [React binding](./react.md), `@ogdakke/fluidbox/react`. The package has nothing specific to Next. This page shows where each piece goes, and how to feed the viewer from Next's image optimizer so it loads the size the screen needs. It was checked with Next.js 16.4 and React 19.3: a `next build` in Chromium, Firefox and WebKit, and `next dev` in Chromium.

## Install

```bash
pnpm add @ogdakke/fluidbox
```

## The stylesheets

Import them once, in the root layout. A server component can import CSS. The filmstrip and the sheet each need their own stylesheet on top of the base one.

```tsx
// app/layout.tsx
import "@ogdakke/fluidbox/styles.css";
// Only with <Fluidbox.Filmstrip />:
import "@ogdakke/fluidbox/filmstrip.css";
// Only with <Fluidbox.Sheet>:
import "@ogdakke/fluidbox/sheet.css";
```

## The items, from the optimizer

`getImageProps` from `next/image` returns the `src` and `srcSet` that `<Image>` would render. Call it twice per photo: once at full-screen `sizes` for the viewer, and once with the triggers' `sizes` for the `thumbnail`.

```ts
// app/photos.ts
import type { FluidboxImageItem } from "@ogdakke/fluidbox";
import { getImageProps } from "next/image";

const files = [
  { src: "/photos/valley.webp", width: 1800, height: 1200, alt: "River valley" },
  { src: "/photos/canyon.webp", width: 1920, height: 1080, alt: "Canyon" },
];

/** The width of a grid column, for the triggers' sizes. */
export const thumbnailSizes = "(min-width: 640px) 25vw, 50vw";

/** An item that keeps its file for <Image>. */
export type Photo = FluidboxImageItem & { readonly file: string };

export const photos: Photo[] = files.map(({ src, width, height, alt }) => {
  const full = getImageProps({ src, width, height, alt, sizes: "100vw" }).props;
  const thumb = getImageProps({ src, width, height, alt, sizes: thumbnailSizes }).props;
  return {
    type: "img",
    file: src,
    src: full.src,
    srcset: full.srcSet,
    sizes: "100vw",
    width,
    height,
    alt,
    thumbnail: { src: thumb.src, srcset: thumb.srcSet, sizes: thumbnailSizes },
  };
});
```

- The `thumbnail` is the same srcset the trigger's `<Image>` renders. The viewer sees that the trigger already shows this photo, so the opening flies the image the page has already decoded. Without a match it crossfades from the trigger to the thumbnail.
- `getImageProps` sets `src` to the largest width, as a fallback for browsers without `srcset`. The viewer picks from the srcset like the browser does. On a 1200 px screen it loads the 1200w file, and the filmstrip takes the thumbnail's smallest candidate.
- `file` is a [field of your own](./media.md#fields-of-your-own). Items don't have to carry an `id`, so the trigger needs the file under another name.

## The gallery

The React parts use hooks, and `Fluidbox` is one object that a server component can't reach into. Put the gallery in a file that starts with `"use client"`, and give it the items as a prop.

```tsx
// app/gallery.tsx
"use client";

import { Fluidbox } from "@ogdakke/fluidbox/react";
import Image from "next/image";
import { thumbnailSizes, type Photo } from "./photos";

export function Gallery({ photos }: { photos: Photo[] }) {
  return (
    <Fluidbox.Root items={photos}>
      <div className="grid">
        {photos.map((photo) => (
          <Fluidbox.Trigger key={photo.file} item={photo}>
            <Image
              src={photo.file}
              width={photo.width}
              height={photo.height}
              alt={photo.alt}
              sizes={thumbnailSizes}
            />
          </Fluidbox.Trigger>
        ))}
      </div>
      <Fluidbox.Filmstrip />
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

The items are plain objects, so they cross from the server component to the client one as props. Keep `thumbnailSizes` in `photos.ts` and not in `gallery.tsx`. A server component that imports a value from a `"use client"` file gets a reference to it, not the string.

## Server rendering

The triggers render on the server as `<button>`s holding your images, so the grid is in the HTML before any JavaScript runs. `Root` makes the viewer in the browser after hydration, and its code loads when a pointer first hovers a trigger. [Loading the viewer](./getting-started.md#loading-the-viewer) has the other options. `next dev` runs React in StrictMode, which `Root` handles.

## Pages Router

The same `Gallery` works in `pages/`. Import the stylesheets in `pages/_app.tsx`, where the Pages Router takes global CSS, and build the items in `getStaticProps` or `getServerSideProps`:

```tsx
// pages/_app.tsx
import "@ogdakke/fluidbox/styles.css";
import "@ogdakke/fluidbox/filmstrip.css";
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

The [photo in the address](./patterns/url.md) pattern reads `location` as it renders, and the server has no `location`. Start with no photo and read the address in an effect:

```tsx
const [photo, setPhoto] = useState<number | null>(null);
useEffect(() => {
  const onPopState = () => setPhoto(photoInUrl());
  onPopState();
  addEventListener("popstate", onPopState);
  return () => removeEventListener("popstate", onPopState);
}, []);
```

The viewer can't open before hydration anyway, so a link with `?photo=2` opens the second photo as soon as the page can run it, flying from its trigger.
