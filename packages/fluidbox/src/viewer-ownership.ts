export interface ActiveViewerOwner {
  closeImmediately(): boolean;
}

// One owner per page, however many copies of the package a page bundles, as a
// theme and an app embed each with their own. The add-on registry does the same.
const key = Symbol.for("@ogdakke/fluidbox/active-viewer");
const slot = (): { active: ActiveViewerOwner | null } =>
  ((globalThis as { [key]?: { active: ActiveViewerOwner | null } })[key] ??= { active: null });

/**
 * The single active body-level viewer, one owner across direct, framework,
 * and custom-element bindings. It coordinates the viewers without owning their UI.
 */
export const activeViewer = {
  get active() {
    return slot().active;
  },
  set active(owner: ActiveViewerOwner | null) {
    slot().active = owner;
  },
  /** Take the portal, returning the owner it was taken from. */
  claim(owner: ActiveViewerOwner): ActiveViewerOwner | null {
    if (this.active === owner) return null;
    const previous = this.active;
    this.active = owner;
    return previous;
  },
  release(owner: ActiveViewerOwner) {
    if (this.active === owner) this.active = null;
  },
};
