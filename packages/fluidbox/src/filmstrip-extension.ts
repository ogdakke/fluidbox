import { FilmstripSession, type FilmstripSessionOptions } from "./filmstrip-session";
import type { FluidboxExtension, FluidboxItem, FluidboxSource } from "./public-api";

export type { FluidboxFilmstripItemContext } from "./filmstrip-session";
export type FluidboxFilmstripOptions<TItem extends FluidboxItem = FluidboxItem> =
  FilmstripSessionOptions<TItem>;

/**
 * A scrubbable thumbnail strip along the bottom of the viewer, for any source
 * with more than one item.
 *
 * ```ts
 * import { filmstrip } from "@ogdakke/fluidbox/filmstrip";
 * createFluidbox({ source, filmstrip: filmstrip() });
 * ```
 */
export function filmstrip<TItem extends FluidboxItem = FluidboxItem>(
  options: FluidboxFilmstripOptions<TItem> = {},
): FluidboxExtension<TItem> {
  return {
    mount({ dialog, controller, source }) {
      let current: FluidboxSource<TItem> = source;
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
