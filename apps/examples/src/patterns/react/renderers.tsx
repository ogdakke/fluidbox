// #region example
import { createContext, useContext } from "react";
import { itemLabel } from "@ogdakke/fluidbox";
import { Fluidbox } from "@ogdakke/fluidbox/react";
import { media, theme, thumbnailSrc } from "../shared";

const ThemeContext = createContext("light");

/** Custom content renders inside the app, so it reads the app's context. */
function Note() {
  const theme = useContext(ThemeContext);
  return <article className="pattern-note">Theme: {theme}</article>;
}

export function Renderers() {
  return (
    <ThemeContext.Provider value={theme}>
      {/* Items of type "custom" whose render is "note" render <Note />. */}
      <Fluidbox.Root items={media} renderers={{ note: () => <Note /> }}>
        <div className="pattern-grid">
          {media.map((item) => (
            <Fluidbox.Trigger
              key={item.id}
              item={item}
              className="pattern-thumb"
              data-test="trigger"
            >
              <img src={thumbnailSrc(item)} alt={itemLabel(item)} />
            </Fluidbox.Trigger>
          ))}
        </div>
      </Fluidbox.Root>
    </ThemeContext.Provider>
  );
}
// #endregion example
