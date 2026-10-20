export type ThumbnailOverlayPhase = "idle" | "opening" | "open" | "dragging" | "closing";

/** The element that holds an overlay's progress: its transition host, when it has one. */
export function overlayProgressHolder(target: HTMLElement) {
  const host = target.parentElement;
  return target.dataset.fluidboxTransitionContent !== undefined &&
    host?.dataset.fluidboxTransitionHost !== undefined
    ? host
    : target;
}

export function publishOverlayPhase(
  target: HTMLElement,
  phase: ThumbnailOverlayPhase,
  progress: number,
) {
  target.dataset.fluidboxPhase = phase;
  overlayProgressHolder(target).style.setProperty("--fluidbox-closed", String(progress));
}

export function resetOverlayPhase(target: HTMLElement) {
  delete target.dataset.fluidboxPhase;
  target.style.removeProperty("--fluidbox-closed");
}
