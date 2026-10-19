import type { Addon } from "./addons";
import { FilmstripSession, type FilmstripSessionOptions } from "./filmstrip-session";
import type { FluidboxFilmstripOptions, FluidboxItem as PublicItem } from "./public-api";
import type { FluidboxItem, FluidboxSource } from "./runtime-types";

export type { FluidboxFilmstripOptions } from "./public-api";

/**
 * A scrubbable thumbnail strip, for more than one item. It mounts in the
 * viewer's layer like your own content, and its CSS places it.
 */
export function createFilmstrip(options: FluidboxFilmstripOptions<PublicItem>): Addon<null> {
  const renderItem: FilmstripSessionOptions<FluidboxItem>["renderItem"] = options.render;
  return {
    handle: null,
    extension: {
      mount({ dialog, controller, source, labels }) {
        let current: FluidboxSource<FluidboxItem> = source;
        let session: FilmstripSession<FluidboxItem> | undefined;
        const build = () => {
          session?.destroy();
          session = undefined;
          if (current.count < 2) return;
          const { requestedIndex, activeIndex } = controller.state;
          session = new FilmstripSession(
            dialog.ownerDocument,
            current,
            controller,
            requestedIndex ?? activeIndex ?? 0,
            { renderItem, labels },
          );
          (dialog.querySelector("[data-fluidbox-portal]") ?? dialog).append(session.dock);
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
          // Its axis comes from CSS, which the viewer can read only once it is
          // in the document. Read it before the opening is measured, so a
          // column doesn't start as a row and shrink the photo it flies to.
          attach: () => session?.measure(),
          relabel: build,
          destroy() {
            unsubscribe();
            session?.destroy();
          },
        };
      },
    },
  };
}
