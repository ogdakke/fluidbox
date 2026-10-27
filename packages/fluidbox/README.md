# @ogdakke/fluidbox

A lightbox for photos, video, iframes and your own content. The picture flies out of its thumbnail, follows gestures, zooms, and lands back where it came from. One runtime, with custom elements, a plain JavaScript API, and React, Solid, Vue and Angular bindings.

```ts
import { createFluidbox } from "@ogdakke/fluidbox";
import "@ogdakke/fluidbox/styles.css";

const fluidbox = createFluidbox({ items: photos, controls: true });
fluidbox.bind(button, 0);
```

| Entry                          | What it holds                                                 |
| ------------------------------ | ------------------------------------------------------------- |
| `@ogdakke/fluidbox`            | `createFluidbox` and the types. Safe to import on the server. |
| `@ogdakke/fluidbox/elements`   | `<fluidbox-gallery>` and its children. Browser only.          |
| `@ogdakke/fluidbox/react`      | The React binding; likewise `/solid`, `/vue`, `/angular`.     |
| `@ogdakke/fluidbox/thumbnails` | The thumbnails add-on. Import it once to turn it on.          |
| `@ogdakke/fluidbox/sheet`      | The sheet add-on, with `@ogdakke/fluidbox/sheet.css`.         |
| `@ogdakke/fluidbox/kit`        | The binding kit, for writing a framework binding.             |
| `@ogdakke/fluidbox/styles.css` | The viewer's layout and default look.                         |

The package stays private while its API is in development. The source repository has the documentation and working examples for every entry point.
