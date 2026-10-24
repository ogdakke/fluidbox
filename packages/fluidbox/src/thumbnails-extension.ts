import type { Addon } from "./addons";
import { ThumbnailsSession, type ThumbnailsSessionOptions } from "./thumbnails-session";
import type { FluidboxThumbnailsOptions, FluidboxItem as PublicItem } from "./public-api";
import type { FluidboxItem, FluidboxSource } from "./runtime-types";

export type { FluidboxThumbnailsOptions } from "./public-api";

/**
 * A scrubbable thumbnail strip, for more than one item. It mounts in the
 * viewer's layer like your own content, and its CSS places it.
 */
export function createThumbnails(options: FluidboxThumbnailsOptions<PublicItem>): Addon<null> {
  const renderItem: ThumbnailsSessionOptions<FluidboxItem>["renderItem"] = options.render;
  return {
    handle: null,
    extension: {
      mount({ dialog, layer, controller, source, labels }) {
        let current: FluidboxSource<FluidboxItem> = source;
        let session: ThumbnailsSession<FluidboxItem> | undefined;
        const build = () => {
          session?.destroy();
          session = undefined;
          if (current.count < 2) return;
          session = new ThumbnailsSession(
            dialog.ownerDocument,
            current,
            controller,
            controller.state.index ?? 0,
            { renderItem, labels },
          );
          layer.append(session.dock);
          session.mount();
        };
        build();
        const unsubscribe = controller.subscribe((state) => {
          const index = state.index;
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
