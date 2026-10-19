import type { Addon } from "./addons";
import { FilmstripSession, type FilmstripSessionOptions } from "./filmstrip-session";
import type {
  FluidboxFilmstrip,
  FluidboxFilmstripOptions,
  FluidboxFilmstripSlot,
  FluidboxItem as PublicItem,
} from "./public-api";
import type { FluidboxItem, FluidboxSource } from "./runtime-types";

export type {
  FluidboxFilmstrip,
  FluidboxFilmstripOptions,
  FluidboxFilmstripSlot,
} from "./public-api";

/** A scrubbable thumbnail strip along the bottom of the viewer, for more than one item. */
export function createFilmstrip(
  options: FluidboxFilmstripOptions<PublicItem>,
): Addon<FluidboxFilmstrip<PublicItem>> {
  const listeners = new Set<() => void>();
  let slots: readonly FluidboxFilmstripSlot<PublicItem>[] = [];
  const setSlots = (next: readonly FluidboxFilmstripSlot<PublicItem>[]) => {
    slots = next;
    for (const listener of listeners) listener();
  };
  const render = options.render;
  const renderItem: FilmstripSessionOptions<FluidboxItem>["renderItem"] = render
    ? render
    : options.slots
      ? ({ item, index, target }) => {
          const slot = { item, index, target };
          setSlots([...slots, slot].sort((a, b) => a.index - b.index));
          return () => setSlots(slots.filter((candidate) => candidate !== slot));
        }
      : undefined;
  return {
    handle: {
      get slots() {
        return slots;
      },
      subscribe(listener) {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    },
    extension: {
      mount({ dialog, controller, source, labels }) {
        let current: FluidboxSource<FluidboxItem> = source;
        let session: FilmstripSession<FluidboxItem> | undefined;
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
            { renderItem, labels },
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
    },
  };
}
