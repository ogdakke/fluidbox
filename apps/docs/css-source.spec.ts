import { expect, test } from "vitest";
import { checkCss } from "./css-source";

// The docs build runs the same check; this catches drift without building them.
test("the CSS reference covers every name the runtime and the stylesheets use", () => {
  expect(() => checkCss()).not.toThrow();
});
