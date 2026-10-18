import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Lightbox, useLightbox } from "@ogdakke/fluidbox/react";
import type {
  LightboxController,
  LightboxEvent,
  LightboxOriginAdapter,
  LightboxSource,
} from "@ogdakke/fluidbox";
import "./photo-library.css";

const sectionSize = 96;
const startingDay = Date.UTC(2026, 8, 23);
export type LibraryImage = {
  readonly src: string;
  readonly width: number;
  readonly height: number;
  readonly shape: string;
};

/** Plain test illustrations. The React page passes the generated landscapes instead. */
export const fixtureImages: readonly LibraryImage[] = [
  { src: "/first.svg", width: 1200, height: 800, shape: "landscape" },
  { src: "/photo-portrait.svg", width: 800, height: 1200, shape: "portrait" },
  { src: "/second.svg", width: 1200, height: 800, shape: "landscape" },
  { src: "/photo-square.svg", width: 900, height: 900, shape: "square" },
];

type LibraryRow =
  | { kind: "date"; key: string; day: number; firstPhoto: number }
  | { kind: "photos"; key: string; firstPhoto: number; count: number };
type RevealContext = { signal: AbortSignal; reason: "open" | "selection" };

function photoId(index: number): string {
  return `synthetic-photo-${index}`;
}

function photoAt(index: number, images: readonly LibraryImage[] = fixtureImages) {
  const fixture = images[(index * 17 + Math.floor(index / sectionSize)) % images.length]!;
  return {
    id: photoId(index),
    media: {
      type: "image" as const,
      src: fixture.src,
      alt: `Synthetic ${fixture.shape} illustration, photo ${index + 1}`,
      width: fixture.width,
      height: fixture.height,
    },
    thumbnail: { src: fixture.src, width: fixture.width, height: fixture.height },
    preview: { src: fixture.src, width: fixture.width, height: fixture.height },
  };
}

type PhotoItem = ReturnType<typeof photoAt>;

function ControllerBridge({
  controllerRef,
}: {
  controllerRef: React.RefObject<LightboxController<PhotoItem> | null>;
}) {
  const controller = useLightbox<PhotoItem>();
  useEffect(() => {
    controllerRef.current = controller;
    return () => {
      if (controllerRef.current === controller) controllerRef.current = null;
    };
  }, [controller, controllerRef]);
  return null;
}

function makeRows(count: number, columns: number) {
  const rows: LibraryRow[] = [];
  const photoToRow = new Uint32Array(count);
  for (let day = 0, first = 0; first < count; day++, first += sectionSize) {
    rows.push({ kind: "date", key: `date-${day}`, day, firstPhoto: first });
    const end = Math.min(first + sectionSize, count);
    for (let photo = first, row = 0; photo < end; photo += columns, row++) {
      const rowIndex = rows.length;
      const rowCount = Math.min(columns, end - photo);
      rows.push({
        kind: "photos",
        key: `date-${day}-row-${row}`,
        firstPhoto: photo,
        count: rowCount,
      });
      for (let index = photo; index < photo + rowCount; index++) photoToRow[index] = rowIndex;
    }
  }
  return { rows, photoToRow };
}

function columnsFor(width: number): number {
  if (width < 560) return 2;
  if (width < 820) return 3;
  if (width < 1120) return 4;
  return 5;
}

export function PhotoLibrary({
  images = fixtureImages,
  embedded = false,
}: {
  images?: readonly LibraryImage[];
  /** Embedded libraries drop the page header and size to their container. */
  embedded?: boolean;
}) {
  const count = new URLSearchParams(location.search).get("count") === "100000" ? 100_000 : 10_000;
  const gallery = useRef<LightboxController<PhotoItem> | null>(null);
  const scrollElement = useRef<HTMLDivElement | null>(null);
  const origins = useRef(new Map<string, HTMLButtonElement>());
  const revealOrigin = useRef<
    ((id: string, index: number, context: RevealContext) => Promise<void>) | null
  >(null);
  const [columns, setColumns] = useState(() => columnsFor(window.innerWidth));
  const [requestedNumber, setRequestedNumber] = useState("1");
  const [showFilmstrip, setShowFilmstrip] = useState(true);
  const [lastViewed, setLastViewed] = useState<number | null>(null);
  const pendingResizeAnchor = useRef<number | null>(null);
  const { rows, photoToRow } = useMemo(() => makeRows(count, columns), [count, columns]);
  const source = useMemo<LightboxSource<PhotoItem>>(
    () => ({
      count,
      getItem(index) {
        return photoAt(index, images);
      },
      getIndex(id) {
        const index = Number(id.slice("synthetic-photo-".length));
        return Number.isInteger(index) && index >= 0 && index < count && photoId(index) === id
          ? index
          : null;
      },
    }),
    [count, images],
  );
  const originAdapter = useMemo<LightboxOriginAdapter>(
    () => ({
      getOrigin(id) {
        const element = origins.current.get(id);
        if (!element?.isConnected || element.dataset.photoId !== id) return null;
        return {
          trigger: element,
          visual: element,
          thumbnail: element.querySelector("img") ?? undefined,
        };
      },
      revealOrigin(id, index, context) {
        return revealOrigin.current?.(id, index, context);
      },
    }),
    [],
  );
  const getScrollElement = useCallback(() => scrollElement.current, []);
  const getItemKey = useCallback((index: number) => rows[index].key, [rows]);
  const estimateSize = useCallback(
    (index: number) => (rows[index].kind === "date" ? 54 : columns === 2 ? 158 : 212),
    [columns, rows],
  );
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement,
    getItemKey,
    estimateSize,
    overscan: 3,
  });
  revealOrigin.current = (id, index, { signal }) => {
    if (signal.aborted || index < 0 || index >= count || photoId(index) !== id) {
      return Promise.resolve();
    }
    const matchingTile = () => {
      const element = origins.current.get(id);
      return element?.isConnected && element.dataset.photoId === id ? element : null;
    };
    const visibleTile = matchingTile();
    if (visibleTile) {
      const bounds = visibleTile.getBoundingClientRect();
      const scroller = scrollElement.current?.getBoundingClientRect();
      if (
        scroller &&
        bounds.top >= Math.max(scroller.top, 0) - 1 &&
        bounds.bottom <= Math.min(scroller.bottom, innerHeight) + 1
      ) {
        return Promise.resolve();
      }
    }
    virtualizer.scrollToIndex(photoToRow[index], { align: "center" });
    return new Promise<void>((resolve) => {
      let frame = 0;
      let remaining = 12;
      const finish = () => {
        cancelAnimationFrame(frame);
        signal.removeEventListener("abort", finish);
        resolve();
      };
      const waitForTile = () => {
        if (signal.aborted) return finish();
        const element = matchingTile();
        if (element) {
          element.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "instant" });
          return finish();
        }
        if (--remaining === 0) return finish();
        frame = requestAnimationFrame(waitForTile);
      };
      signal.addEventListener("abort", finish, { once: true });
      frame = requestAnimationFrame(waitForTile);
    });
  };

  const onLightboxEvent = useCallback(
    (event: LightboxEvent) => {
      if (event.type === "selection-settle" && event.index >= 0 && event.index < count) {
        setLastViewed(event.index);
      }
    },
    [count],
  );

  useLayoutEffect(() => {
    const element = scrollElement.current;
    if (!element) return;
    const observer = new ResizeObserver(() => {
      const next = columnsFor(element.clientWidth);
      if (next === columns) return;
      const firstVirtualRow = virtualizer
        .getVirtualItems()
        .find((row) => row.end > element.scrollTop);
      pendingResizeAnchor.current = firstVirtualRow ? rows[firstVirtualRow.index].firstPhoto : 0;
      setColumns(next);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [columns, rows, virtualizer]);

  useLayoutEffect(() => {
    virtualizer.measure();
    if (pendingResizeAnchor.current !== null) {
      virtualizer.scrollToIndex(photoToRow[pendingResizeAnchor.current], { align: "start" });
      pendingResizeAnchor.current = null;
    }
  }, [photoToRow, virtualizer]);

  function openPhoto(index: number) {
    setLastViewed(index);
    void gallery.current?.open({ index });
  }

  function scrollToPhoto(index: number) {
    virtualizer.scrollToIndex(photoToRow[index], { align: "center" });
  }

  const requested = Number(requestedNumber) - 1;
  const validRequested = Number.isInteger(requested) && requested >= 0 && requested < count;
  const virtualRows = virtualizer.getVirtualItems();
  const firstVisible = virtualRows.find((row) => rows[row.index].kind === "photos");
  const lastVisible = [...virtualRows].reverse().find((row) => rows[row.index].kind === "photos");
  const visibleStart = firstVisible ? rows[firstVisible.index].firstPhoto + 1 : 1;
  const lastRow = lastVisible ? rows[lastVisible.index] : null;
  const visibleEnd = lastRow?.kind === "photos" ? lastRow.firstPhoto + lastRow.count : visibleStart;

  return (
    <Lightbox.Root source={source} origins={originAdapter} onEvent={onLightboxEvent}>
      <ControllerBridge controllerRef={gallery} />
      <main
        className={embedded ? "library-page library-page--embedded" : "library-page"}
        data-library-count={count}
      >
        {!embedded && (
          <header className="library-header">
            <p className="fb-label">Fluidbox × TanStack Virtual</p>
            <h1>A long photo library</h1>
            <p>
              Scroll the host grid, open a thumbnail, then navigate in the viewer. These are
              repeated local SVG illustrations with mixed dimensions, useful for geometry and DOM
              checks. They are not a photo decoding or transfer benchmark.
            </p>
          </header>
        )}

        <div className="library-controls">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (validRequested) scrollToPhoto(requested);
            }}
          >
            <label htmlFor="photo-number">Photo number</label>
            <input
              id="photo-number"
              className="fb-input"
              type="number"
              min="1"
              max={count}
              value={requestedNumber}
              onChange={(event) => setRequestedNumber(event.target.value)}
            />
            <button type="submit" className="fb-button" disabled={!validRequested}>
              Jump in library
            </button>
            <button
              type="button"
              className="fb-button fb-button--primary"
              disabled={!validRequested}
              onClick={() => openPhoto(requested)}
            >
              Open number
            </button>
          </form>
          <div className="library-controls-end">
            <label className="library-checkbox">
              <input
                type="checkbox"
                checked={showFilmstrip}
                onChange={(event) => setShowFilmstrip(event.target.checked)}
              />
              Show filmstrip on next open
            </label>
            <a
              className="fb-button fb-button--small"
              href={count === 10_000 ? "?count=100000" : "?count=10000"}
            >
              {count === 10_000 ? "Try 100,000 items" : "Back to 10,000 items"}
            </a>
            <button
              type="button"
              className="fb-button fb-button--small"
              disabled={lastViewed === null}
              onClick={() => lastViewed !== null && scrollToPhoto(lastViewed)}
            >
              Reveal last viewed
            </button>
          </div>
        </div>

        <p className="library-count">
          {count.toLocaleString()} synthetic items. Rows near the viewport are mounted with
          three-row overscan.{" "}
          <span aria-live="off">
            Mounted range {visibleStart}–{visibleEnd}.
          </span>
        </p>
        <Lightbox.Portal>
          {showFilmstrip && <Lightbox.Filmstrip />}
          <Lightbox.Previous aria-label="Previous photo" />
          <Lightbox.Next aria-label="Next photo" />
          <Lightbox.Close aria-label="Close" />
        </Lightbox.Portal>
        <div className="library-scroll" ref={scrollElement} tabIndex={0} aria-label="Photo library">
          <div className="library-track" style={{ height: virtualizer.getTotalSize() }}>
            {virtualRows.map((virtualRow) => {
              const row = rows[virtualRow.index];
              return (
                <div
                  key={virtualRow.key}
                  className={row.kind === "date" ? "library-date-row" : "library-photo-row"}
                  data-row-index={virtualRow.index}
                  data-row-kind={row.kind}
                  style={{
                    height: virtualRow.size,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  {row.kind === "date" ? (
                    <h2 className="fb-rule-title">
                      {new Date(startingDay - row.day * 86_400_000).toLocaleDateString("en-US", {
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                        timeZone: "UTC",
                      })}
                    </h2>
                  ) : (
                    <div
                      className="library-photo-grid"
                      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
                    >
                      {Array.from({ length: row.count }, (_, offset) => {
                        const index = row.firstPhoto + offset;
                        const photo = photoAt(index, images);
                        return (
                          <Lightbox.Item key={photo.id} id={photo.id}>
                            <Lightbox.Trigger asChild>
                              <button
                                type="button"
                                className="library-photo"
                                data-lightbox-preview=""
                                data-photo-id={photo.id}
                                data-photo-index={index}
                                aria-label={`Open ${photo.media.alt}, item ${index + 1} of ${count}`}
                                ref={(node) => {
                                  if (!node) return;
                                  origins.current.set(photo.id, node);
                                  return () => {
                                    if (origins.current.get(photo.id) === node)
                                      origins.current.delete(photo.id);
                                  };
                                }}
                                onClick={() => setLastViewed(index)}
                              >
                                <img
                                  src={photo.thumbnail.src}
                                  alt=""
                                  width={photo.media.width}
                                  height={photo.media.height}
                                  loading="lazy"
                                  decoding="async"
                                />
                                <span>{String(index + 1).padStart(5, "0")}</span>
                              </button>
                            </Lightbox.Trigger>
                          </Lightbox.Item>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        <p className="library-note">
          The grid follows the selected photo on open and after viewer navigation. “Reveal last
          viewed” recenters it if you scroll elsewhere after closing.
        </p>
      </main>
    </Lightbox.Root>
  );
}
