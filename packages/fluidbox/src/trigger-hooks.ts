/**
 * What add-ons do to a trigger's element: as it becomes a trigger, and again
 * as its content changes. A hook may return what undoes it, called when the
 * element stops being a trigger. The model add-on quiets a live
 * `<model-viewer>` in it. A page that imports no such add-on pays for an empty set.
 */
export const triggerHooks = new Set<(trigger: HTMLElement) => (() => void) | void>();
