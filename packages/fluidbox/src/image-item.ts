import type { FluidboxImageItem, FluidboxThumbnail } from "./public-api";

/** An `<img>`'s props, in React's spelling or the HTML one, as `getImageProps` from `next/image` returns them. */
export interface FluidboxImageProps {
  readonly src: string;
  readonly srcSet?: string | undefined;
  readonly srcset?: string | undefined;
  readonly sizes?: string | undefined;
  readonly width?: number | `${number}` | undefined;
  readonly height?: number | `${number}` | undefined;
  readonly alt?: string | undefined;
  /** A blur placeholder sits here as a `url()`, as `next/image` puts it. */
  readonly style?: { readonly backgroundImage?: string | undefined } | undefined;
}

/**
 * An image item from an `<img>`'s props. `image` is the full-size one for the
 * viewer, and `thumbnail`, at the triggers' `sizes`, becomes its thumbnail. A
 * `url()` in either one's `style.backgroundImage`, such as the blur
 * `next/image` makes, becomes the placeholder.
 */
export function imageItem(
  image: FluidboxImageProps,
  thumbnail?: FluidboxImageProps,
): FluidboxImageItem {
  const width = Number(image.width ?? thumbnail?.width);
  const height = Number(image.height ?? thumbnail?.height);
  if (!(width > 0 && height > 0)) {
    throw new TypeError(`imageItem needs the width and height of ${image.src}`);
  }
  const placeholder = backgroundUrl(image) ?? (thumbnail && backgroundUrl(thumbnail));
  return {
    type: "img",
    ...sources(image),
    alt: image.alt ?? thumbnail?.alt ?? "",
    width,
    height,
    ...(thumbnail ? { thumbnail: { ...sources(thumbnail), width, height } } : {}),
    ...(placeholder ? { placeholder } : {}),
  };
}

function sources(props: FluidboxImageProps): FluidboxThumbnail {
  const srcset = props.srcset ?? props.srcSet;
  return {
    src: props.src,
    ...(srcset ? { srcset } : {}),
    ...(props.sizes ? { sizes: props.sizes } : {}),
  };
}

function backgroundUrl(props: FluidboxImageProps) {
  return props.style?.backgroundImage?.match(/^url\((["']?)(.+)\1\)$/)?.[2];
}
