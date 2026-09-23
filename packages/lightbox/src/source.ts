/** Item metadata stays independent of mounted thumbnail nodes. IDs must remain stable while open. */
export interface LightboxSourceItem {
  id: string;
  src: string;
  alt?: string;
  thumbnailSrc?: string;
  previewSrc?: string;
  width?: number;
  height?: number;
}

/** A host virtual list can provide any item by index and optionally resolve a mounted origin. */
export interface LightboxGallerySource {
  readonly count: number;
  getItem(index: number): LightboxSourceItem;
  getOrigin?(id: string): HTMLElement | null;
}
