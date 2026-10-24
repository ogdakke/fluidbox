import { expect, test } from "vitest";
import { checkBaselineCss } from "../../../scripts/check-baseline-css";

// The build runs the same check; this catches a dead baseline rule without building.
test("baseline.css sets nothing the unlayered functional CSS sets, and has no !important", () => {
  expect(checkBaselineCss()).toEqual([]);
});

const scope = ":where([data-fluidbox-viewer], [data-fluidbox-flight])";
const look = (css: string) => `@layer fluidbox-baseline;\n@layer fluidbox-baseline {${css}}`;

test("a property the functional CSS sets on the same element is dead in the baseline", () => {
  const functional: [string, string][] = [
    ["styles.css", `${scope} [data-fluidbox-thumbnails] { transform: none; opacity: 1; }`],
  ];
  // The same selector, and a state of the same element, both lose.
  expect(
    checkBaselineCss(
      look(`${scope} [data-fluidbox-thumbnails] { transform: scale(2); }`),
      functional,
    ),
  ).toHaveLength(1);
  expect(
    checkBaselineCss(
      look(
        `${scope} [data-fluidbox-dialog][data-zoomed] [data-fluidbox-thumbnails] { opacity: 0.5; }`,
      ),
      functional,
    ),
  ).toHaveLength(1);
  // A longhand of a shorthand set there loses too; a property the shorthand
  // doesn't set, or another element, is fine.
  expect(
    checkBaselineCss(look(`${scope} [data-fluidbox-thumbnails] { transform-origin: top; }`), [
      ["styles.css", `${scope} [data-fluidbox-thumbnails] { transform: none; }`],
    ]),
  ).toEqual([]);
  expect(
    checkBaselineCss(look(`${scope} [data-fluidbox-close] { opacity: 0.5; }`), functional),
  ).toEqual([]);
  expect(
    checkBaselineCss(look(`${scope} [data-fluidbox-thumbnails-item] { border-radius: 3px; }`), [
      ["thumbnails.css", `${scope} [data-fluidbox-thumbnails-item] { all: unset; }`],
    ]),
  ).toHaveLength(1);
});

test("a functional rule under its own condition only overrides the baseline there", () => {
  expect(
    checkBaselineCss(look(`${scope} :focus-visible { outline: 2px solid; }`), [
      [
        "styles.css",
        `@media (forced-colors: active) { ${scope} :focus-visible { outline-color: Highlight; } }`,
      ],
    ]),
  ).toEqual([]);
});

test("baseline.css has no !important", () => {
  expect(
    checkBaselineCss(look(`${scope} [data-fluidbox-close] { display: none !important; }`), []),
  ).toHaveLength(1);
});
