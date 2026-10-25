import "@ogdakke/fluidbox";

for (const subpath of [
  "",
  "/react",
  "/react/embed",
  "/react/model",
  "/react/spin",
  "/solid",
  "/vue",
  "/vue/embed",
  "/vue/model",
  "/vue/spin",
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

// A Nuxt-style server render: a Vue Root open on an image draws the viewer's
// copy into the HTML, with room for the thumbnails its part turns on.
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
  console.log("SSR render passed: @ogdakke/fluidbox/vue, a Root open on an image");
}
