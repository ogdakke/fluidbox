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
