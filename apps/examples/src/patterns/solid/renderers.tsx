/** @jsxImportSource solid-js */
// #region example
import { createContext, For, useContext } from "solid-js";
import { Fluidbox } from "@ogdakke/fluidbox/solid";
import { label, media, theme, thumbnailSrc } from "../shared";

const ThemeContext = createContext("light");

function Note() {
  // Renderers run under Root, so context provided around it reaches them.
  const theme = useContext(ThemeContext);
  return <article class="pattern-note">Theme: {theme}</article>;
}

export function Renderers() {
  return (
    <ThemeContext.Provider value={theme}>
      {/* Draws items of type "custom" whose render is "note". */}
      <Fluidbox.Root items={media} renderers={{ note: () => <Note /> }}>
        <div class="pattern-grid">
          <For each={media}>
            {(item) => (
              <Fluidbox.Trigger item={item} class="pattern-thumb" data-test="trigger">
                <img src={thumbnailSrc(item)} alt={label(item)} />
              </Fluidbox.Trigger>
            )}
          </For>
        </div>
      </Fluidbox.Root>
    </ThemeContext.Provider>
  );
}
// #endregion example
