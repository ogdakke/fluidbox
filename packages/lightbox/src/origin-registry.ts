import type {
  LightboxDispose,
  LightboxItemId,
  LightboxOrigin,
  LightboxOriginAdapter,
} from "./public-api";

interface OriginRegistration {
  readonly origin: LightboxOrigin;
  readonly token: object;
}

/** Resolves composed-item origins without letting stale cleanup remove a replacement. */
export class OriginRegistry {
  readonly #adapter: LightboxOriginAdapter | undefined;
  readonly #registrations = new Map<LightboxItemId, OriginRegistration>();

  constructor(adapter?: LightboxOriginAdapter) {
    this.#adapter = adapter;
  }

  get(id: LightboxItemId): LightboxOrigin | null {
    const registered = this.#registrations.get(id);
    if (registered) return registered.origin;

    try {
      return this.#adapter?.getOrigin(id) ?? null;
    } catch {
      return null;
    }
  }

  register(id: LightboxItemId, origin: LightboxOrigin): LightboxDispose {
    const token = {};
    this.#registrations.set(id, { origin, token });
    let disposed = false;

    return () => {
      if (disposed) return;
      disposed = true;
      if (this.#registrations.get(id)?.token === token) this.#registrations.delete(id);
    };
  }

  clear() {
    this.#registrations.clear();
  }
}
