export interface ActiveViewerOwner {
  closeImmediately(): boolean;
}

/**
 * The single active body-level viewer, one owner across direct, framework,
 * and custom-element bindings. It coordinates the viewers without owning their UI.
 */
export const activeViewer = {
  active: null as ActiveViewerOwner | null,
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
