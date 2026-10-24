import "@ogdakke/fluidbox";

for (const subpath of [
  "",
  "/react",
  "/solid",
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
