// #region example
import { createContext, useContext } from "react";
import { itemLabel } from "@ogdakke/fluidbox";
import { Fluidbox } from "@ogdakke/fluidbox/react";
import { media, theme, thumbnailSrc } from "../shared";

const ThemeContext = createContext("light");

/** Slide content renders inside the app, so it reads the app's context. */
function Note() {
  const theme = useContext(ThemeContext);
  return <article className="pattern-note">Theme: {theme}</article>;
}

export function Renderers() {
  return (
    <ThemeContext.Provider value={theme}>
      <Fluidbox.Root items={media}>
        <div className="pattern-grid">
          {media.map((item) => (
            <Fluidbox.Trigger
              key={item.id}
              value={item.id}
              className="pattern-thumb"
              data-test="trigger"
            >
              <img src={thumbnailSrc(item)} alt={itemLabel(item)} />
            </Fluidbox.Trigger>
          ))}
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
