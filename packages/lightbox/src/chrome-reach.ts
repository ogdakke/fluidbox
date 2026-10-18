/**
 * How far the browser's own bars can reach past the layout viewport. iOS 26
 * Safari paints the page under its status bar and toolbar, but a scroller clips
 * to its box, so boxes the size of the viewport reach under them by this much.
 * The whole screen-to-window difference covers either bar wherever it sits;
 * extra reach only paints off screen. Standalone web apps get about zero.
 */
export function chromeReach(view: Window): number {
  if (!view.matchMedia("(pointer: coarse)").matches) return 0;
  const { width, height } = view.screen;
  const long = Math.max(width, height);
  const short = Math.min(width, height);
  const screenHeight = view.innerWidth > view.innerHeight ? short : long;
  return Math.max(0, Math.ceil(screenHeight - view.innerHeight));
}
