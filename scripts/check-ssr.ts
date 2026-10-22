import "@ogdakke/fluidbox";

for (const subpath of [
  "",
  "/react",
  "/solid",
  "/vue",
  "/angular",
  "/filmstrip",
  "/sheet",
  "/kit",
  "/hover-zoom",
  "/embeds",
  "/model",
  "/spin",
]) {
  const name = `@ogdakke/fluidbox${subpath}`;
  await import(name);
  console.log(`SSR import passed: ${name}`);
}
