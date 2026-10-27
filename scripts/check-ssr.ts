import "@ogdakke/fluidbox";
import type * as AngularBinding from "@ogdakke/fluidbox/angular";
// An Angular SSR render through platform-server: a fluidboxRoot whose value
// opens it on an image draws the viewer's copy into the HTML, with room for
// the thumbnails its part turns on, and turns no add-on on. The binding is a
// partial build, which @angular/compiler links as the components load.
{
  await import("@angular/compiler");
  const { Component, provideZonelessChangeDetection } = await import("@angular/core");
  const { bootstrapApplication } = await import("@angular/platform-browser");
  const { renderApplication } = await import("@angular/platform-server");
  // The built entry, as an app gets it: the tsconfig path to the source would
  // load the binding with its own Angular, the 17.3 it compiles against.
  const { FluidboxModule } = (await import(
    "../packages/fluidbox/dist/angular/index.js" as string
  )) as typeof AngularBinding;
  const photos = ["one", "two"].map((id) => ({
    type: "image" as const,
    id,
    src: `/${id}.jpg`,
    alt: `Photo ${id}`,
    width: 800,
    height: 600,
  }));
  @Component({
    selector: "app-root",
    standalone: true,
    imports: [FluidboxModule],
    template: `
      <div fluidboxRoot [items]="photos" [value]="'two'">
        @for (photo of photos; track photo.id) {
          <button [fluidboxTrigger]="photo.id"><img [src]="photo.src" [alt]="photo.alt" /></button>
        }
        <ng-container fluidboxThumbnails />
        <ng-template fluidboxSheet>Details</ng-template>
        <ng-template fluidboxViewer><button fluidboxClose></button></ng-template>
      </div>
    `,
  })
  class App {
    readonly photos = photos;
  }
  const html = await renderApplication(
    (context) =>
      bootstrapApplication(App, { providers: [provideZonelessChangeDetection()] }, context),
    {
      document: "<!doctype html><html><head></head><body><app-root></app-root></body></html>",
      url: "/",
    },
  );
  const copy = html.slice(html.indexOf("data-fluidbox-server-viewer"));
  if (!html.includes("data-fluidbox-server-viewer") || !copy.includes('src="/two.jpg"')) {
    throw new Error(`An Angular fluidboxRoot open on an image renders no server copy:\n${html}`);
  }
  if (!copy.includes("data-fluidbox-thumbnails")) {
    throw new Error(`The Angular server copy leaves no room for the thumbnails:\n${html}`);
  }
  await new Promise((resolve) => setTimeout(resolve, 50));
  const addons = (globalThis as Record<symbol, object | undefined>)[
    Symbol.for("@ogdakke/fluidbox/addons")
  ];
  if (addons && Object.keys(addons).length) {
    throw new Error(`An Angular server render loaded add-ons: ${Object.keys(addons).join(", ")}`);
  }
  console.log("SSR render passed: @ogdakke/fluidbox/angular, a fluidboxRoot open on an image");
}

// A Nuxt-style server render: a Vue Root open on an image draws the viewer's
// copy into the HTML, with room for the thumbnails its part turns on. It runs
// before the imports below, as the thumbnails and sheet entries register add-ons.
{
  const { createSSRApp, h } = await import("vue");
  const { renderToString } = await import("vue/server-renderer");
  const { Fluidbox } = await import("@ogdakke/fluidbox/vue");
  const photos = ["one", "two"].map((id) => ({
    type: "image" as const,
    id,
    src: `/${id}.jpg`,
    alt: `Photo ${id}`,
    width: 800,
    height: 600,
  }));
  const html = await renderToString(
    createSSRApp({
      render: () =>
        h(Fluidbox.Root, { items: photos, modelValue: "two" }, () => [
          photos.map((photo) =>
            h(Fluidbox.Trigger, { key: photo.id, value: photo.id }, () =>
              h("img", { src: photo.src, alt: photo.alt }),
            ),
          ),
          h(Fluidbox.Thumbnails),
          h(Fluidbox.Sheet),
          h(Fluidbox.Viewer, null, () => h(Fluidbox.Close)),
        ]),
    }),
  );
  const copy = html.slice(html.indexOf("data-fluidbox-server-viewer"));
  if (!html.includes("data-fluidbox-server-viewer") || !copy.includes('src="/two.jpg"')) {
    throw new Error(`A Vue Root open on an image renders no server copy:\n${html}`);
  }
  if (!copy.includes("data-fluidbox-thumbnails")) {
    throw new Error(`The Vue server copy leaves no room for the thumbnails:\n${html}`);
  }
  // The parts turn the add-ons on once mounted, so the server loads none.
  await new Promise((resolve) => setTimeout(resolve, 50));
  const addons = (globalThis as { [key: symbol]: object | undefined })[
    Symbol.for("@ogdakke/fluidbox/addons")
  ];
  if (Object.keys(addons ?? {}).length) {
    throw new Error(`A Vue server render loaded add-ons: ${Object.keys(addons!).join(", ")}`);
  }
  console.log("SSR render passed: @ogdakke/fluidbox/vue, a Root open on an image");
}

// A SolidStart-style server render: a Solid Root open on an image draws the
// viewer's copy into the HTML, with room for the thumbnails its part turns on.
// It runs before the imports below load the thumbnails and sheet entries, to
// show the parts register nothing on the server: no add-on entry loads.
{
  const { createComponent, renderToString, Dynamic } = await import("solid-js/web");
  const { Fluidbox } = await import("@ogdakke/fluidbox/solid");
  const photos = ["one", "two"].map((id) => ({
    type: "image" as const,
    id,
    src: `/${id}.jpg`,
    alt: `Photo ${id}`,
    width: 800,
    height: 600,
  }));
  const html = renderToString(() =>
    createComponent(Fluidbox.Root, {
      items: photos,
      value: "two",
      get children() {
        return [
          ...photos.map((photo) =>
            createComponent(Fluidbox.Trigger, {
              value: photo.id,
              get children() {
                return createComponent(Dynamic, {
                  component: "img",
                  src: photo.src,
                  alt: photo.alt,
                });
              },
            }),
          ),
          createComponent(Fluidbox.Thumbnails, {}),
          createComponent(Fluidbox.Sheet, { children: () => "Details" }),
        ];
      },
    }),
  );
  const copy = html.slice(html.indexOf("data-fluidbox-server-viewer"));
  if (!html.includes("data-fluidbox-server-viewer") || !copy.includes('src="/two.jpg"')) {
    throw new Error(`A Solid Root open on an image renders no server copy:\n${html}`);
  }
  if (!copy.includes("data-fluidbox-thumbnails")) {
    throw new Error(`The Solid server copy leaves no room for the thumbnails:\n${html}`);
  }
  await new Promise((resolve) => setTimeout(resolve, 50));
  const addons = (globalThis as Record<symbol, object | undefined>)[
    Symbol.for("@ogdakke/fluidbox/addons")
  ];
  if (addons && Object.keys(addons).length) {
    throw new Error(`A Solid server render loaded add-ons: ${Object.keys(addons).join(", ")}`);
  }
  console.log("SSR render passed: @ogdakke/fluidbox/solid, a Root open on an image");
}

for (const subpath of [
  "",
  "/react",
  "/react/embed",
  "/react/model",
  "/react/spin",
  "/solid",
  "/solid/embed",
  "/solid/model",
  "/solid/spin",
  "/vue",
  "/vue/embed",
  "/vue/model",
  "/vue/spin",
  "/angular",
  "/angular/embed",
  "/angular/model",
  "/angular/spin",
  "/thumbnails",
  "/sheet",
  "/kit",
  "/hover-zoom",
  "/embed",
  "/model",
  "/spin",
]) {
  const name = `@ogdakke/fluidbox${subpath}`;
  await import(name);
  console.log(`SSR import passed: ${name}`);
}
