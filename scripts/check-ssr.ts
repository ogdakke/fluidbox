import "@ogdakke/fluidbox";

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
  "/angular",
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

// A SolidStart-style server render: a Solid Root open on an image draws the
// viewer's copy into the HTML, with room for the thumbnails its part turns on.
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
  console.log("SSR render passed: @ogdakke/fluidbox/solid, a Root open on an image");
}
