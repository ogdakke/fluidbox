/**
 * Framework logos, from svgl.app, served at /icons/ by both sites. React has a
 * logo for each theme; the stylesheet shows the one that fits. They are
 * decorative: the name is always written beside them.
 */
export type FrameworkIconKey = "react" | "vue" | "solid" | "angular" | "elements" | "javascript";

const image = (file: string, className: string) =>
  `<img class="${className}" src="/icons/${file}.svg" alt="" width="16" height="16" decoding="async" />`;

/** An `<img>` (two for React) to put before a framework's name. */
export function frameworkIcon(key: FrameworkIconKey): string {
  if (key === "react") {
    return (
      image("react-light", "fb-framework-icon fb-framework-icon--light") +
      image("react-dark", "fb-framework-icon fb-framework-icon--dark")
    );
  }
  return image(key, "fb-framework-icon");
}

/** The interface icons, symbols in one sprite that both sites serve and the browser caches. */
export type UiIcon = "copy" | "check" | "sun";

/** An icon from the sprite: a `<use>` reference, not a copy of its paths. */
export function uiIcon(name: UiIcon, size = 13): string {
  return `<svg class="fb-icon" width="${size}" height="${size}" aria-hidden="true"><use href="/icons/ui.svg#${name}"></use></svg>`;
}
