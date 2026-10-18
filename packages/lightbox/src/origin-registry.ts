import type {
  LightboxDispose,
  LightboxItemId,
  LightboxOrigin,
  LightboxOriginAdapter,
} from "./public-api";
import { observeDecodedPreview } from "./decoded-preview";

interface OriginRegistration {
  readonly origin: LightboxOrigin;
  readonly token: object;
}

/** Resolves composed-item origins without letting stale cleanup remove a replacement. */
export class OriginRegistry {
  readonly #adapter: LightboxOriginAdapter | undefined;
  readonly #registrations = new Map<LightboxItemId, OriginRegistration>();
  readonly #shared = new Map<LightboxItemId, OriginRegistration[]>();
  #hiddenId: LightboxItemId | null = null;
  #hiddenThumbnail: HTMLImageElement | null = null;

  constructor(adapter?: LightboxOriginAdapter) {
    this.#adapter = adapter;
  }

  get(id: LightboxItemId): LightboxOrigin | null {
    const registered = this.#registrations.get(id);
    if (registered && registered.origin.trigger.isConnected !== false) return registered.origin;
    const shared = this.#shared.get(id);
    if (shared) {
      for (let index = shared.length - 1; index >= 0; index -= 1) {
        const origin = shared[index]!.origin;
        if (origin.trigger.isConnected !== false) return origin;
      }
    }

    try {
      const origin = this.#adapter?.getOrigin(id) ?? null;
      if (origin?.thumbnail) observeDecodedPreview(origin.thumbnail);
      return origin;
    } catch {
      return null;
    }
  }

  register(id: LightboxItemId, origin: LightboxOrigin, shared = false): LightboxDispose {
    const token = {};
    if (origin.thumbnail) observeDecodedPreview(origin.thumbnail);
    if (shared) {
      const registrations = this.#shared.get(id) ?? [];
      registrations.push({ origin, token });
      this.#shared.set(id, registrations);
    } else {
      this.#registrations.set(id, { origin, token });
    }
    if (id === this.#hiddenId && this.get(id) === origin) this.#hideOriginThumbnail(origin);
    let disposed = false;

    return () => {
      if (disposed) return;
      disposed = true;
      if (shared) {
        const registrations = this.#shared.get(id);
        const index =
          registrations?.findIndex((registration) => registration.token === token) ?? -1;
        if (index < 0) return;
        registrations!.splice(index, 1);
        if (!registrations!.length) this.#shared.delete(id);
      } else {
        if (this.#registrations.get(id)?.token !== token) return;
        this.#registrations.delete(id);
      }
      if (id === this.#hiddenId) {
        this.#restoreThumbnail();
        const current = this.get(id);
        if (current) this.#hideOriginThumbnail(current);
      }
    };
  }

  hideThumbnail(id: LightboxItemId) {
    this.#hiddenId = id;
    this.#restoreThumbnail();
    const origin = this.get(id);
    if (origin) this.#hideOriginThumbnail(origin);
  }

  restoreThumbnail() {
    this.#hiddenId = null;
    this.#restoreThumbnail();
  }

  clear() {
    this.restoreThumbnail();
    this.#registrations.clear();
    this.#shared.clear();
  }

  #hideOriginThumbnail(origin: LightboxOrigin) {
    const thumbnail =
      origin.thumbnail ??
      (origin.visual instanceof HTMLImageElement
        ? origin.visual
        : origin.visual.querySelector<HTMLImageElement>("img"));
    if (!thumbnail) return;
    if (thumbnail === this.#hiddenThumbnail) return;
    this.#restoreThumbnail();
    this.#hiddenThumbnail = thumbnail;
    thumbnail.dataset.lightboxThumbnailHidden = "";
  }

  #restoreThumbnail() {
    if (!this.#hiddenThumbnail) return;
    delete this.#hiddenThumbnail.dataset.lightboxThumbnailHidden;
    this.#hiddenThumbnail = null;
  }
}
