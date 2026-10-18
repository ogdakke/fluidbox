import { FilmstripSession, type FilmstripSessionOptions } from "./filmstrip-session";
import type { LightboxExtension, LightboxItem, LightboxSource } from "./public-api";

export type { LightboxFilmstripItemContext } from "./filmstrip-session";
export type LightboxFilmstripOptions<TItem extends LightboxItem = LightboxItem> =
  FilmstripSessionOptions<TItem>;

/**
 * A scrubbable thumbnail strip along the bottom of the viewer, for any source
 * with more than one item.
 *
 * ```ts
 * import { filmstrip } from "@ogdakke/fluidbox/filmstrip";
 * createLightbox({ source, filmstrip: filmstrip() });
 * ```
 */
export function filmstrip<TItem extends LightboxItem = LightboxItem>(
  options: LightboxFilmstripOptions<TItem> = {},
): LightboxExtension<TItem> {
  return {
    mount({ dialog, controller, source }) {
      let current: LightboxSource<TItem> = source;
      let session: FilmstripSession<TItem> | undefined;
      const build = () => {
        session?.destroy();
        session = undefined;
        const wanted = current.count > 1;
        dialog.toggleAttribute("data-filmstrip", wanted);
        if (!wanted) return;
        const { requestedIndex, activeIndex } = controller.state;
        session = new FilmstripSession(
          dialog.ownerDocument,
          current,
          controller,
          requestedIndex ?? activeIndex ?? 0,
          options,
        );
        dialog.append(session.dock);
        session.mount();
      };
      build();
      const unsubscribe = controller.subscribe((state) => {
        const index = state.requestedIndex ?? state.activeIndex;
        if (index !== null) session?.sync(index);
      });
      return {
        setSource(next) {
          if (next === current) return;
          current = next;
          build();
        },
        destroy() {
          unsubscribe();
          session?.destroy();
          dialog.removeAttribute("data-filmstrip");
        },
      };
    },
  };
}
