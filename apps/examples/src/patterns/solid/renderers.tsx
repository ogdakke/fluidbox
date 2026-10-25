/** @jsxImportSource solid-js */
// #region example
import { createContext, For, useContext } from "solid-js";
import { itemLabel } from "@ogdakke/fluidbox";
import { Fluidbox } from "@ogdakke/fluidbox/solid";
import { media, theme, thumbnailSrc } from "../shared";

const ThemeContext = createContext("light");

/** Slide content renders under the Root, so it reads the app's context. */
function Note() {
  const theme = useContext(ThemeContext);
  return <article class="pattern-note">Theme: {theme}</article>;
}

export function Renderers() {
  return (
    <ThemeContext.Provider value={theme}>
      <Fluidbox.Root items={media}>
        <div class="pattern-grid">
          <For each={media}>
            {(item) => (
              <Fluidbox.Trigger value={item.id} class="pattern-thumb" data-test="trigger">
                <img src={thumbnailSrc(item)} alt={itemLabel(item)} />
              </Fluidbox.Trigger>
            )}
          </For>
        </div>
        {/* Items of type "note" render <Note /> in their media box; the rest are built in. */}
        <Fluidbox.Slides
          note={() => (
            <Fluidbox.Media>
              <Note />
            </Fluidbox.Media>
          )}
        />
      </Fluidbox.Root>
    </ThemeContext.Provider>
  );
}
// #endregion example
