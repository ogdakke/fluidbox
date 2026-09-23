/** Coordinates the single active body-level viewer without owning its UI. */
export class ViewerOwnership<TOwner extends object> {
  #active: TOwner | null = null;

  get active(): TOwner | null {
    return this.#active;
  }

  claim(owner: TOwner): TOwner | null {
    if (this.#active === owner) return null;
    const previous = this.#active;
    this.#active = owner;
    return previous;
  }

  release(owner: TOwner): boolean {
    if (this.#active !== owner) return false;
    this.#active = null;
    return true;
  }
}

export interface ActiveViewerOwner {
  closeImmediately(): void;
}

/** One owner across direct, framework, and custom-element bindings. */
export const activeViewer = new ViewerOwnership<ActiveViewerOwner>();
