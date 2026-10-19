import "@ogdakke/fluidbox/sheet.css";
import { photoSrc, photoThumb, photos, type Photo } from "../photos";

const image = (photo: Photo, src: string) => {
  const img = document.createElement("img");
  img.src = src;
  img.alt = photo.title;
  img.width = photo.width;
  img.height = photo.height;
  return img;
};

/** The info sheet's content for one photo, as a floating card. */
function sheetTemplate(photo: Photo): HTMLTemplateElement {
  const template = document.createElement("template");
  template.setAttribute("slot", "sheet");
  const card = document.createElement("div");
  card.className = "info-card";
  card.dataset.fluidboxSheetScroll = "";
  card.innerHTML = `
    <span class="info-card__grabber" aria-hidden="true"></span>
    <h3></h3>
    <p class="info-card__credit">Photo by <a target="_blank" rel="noopener"></a> on Unsplash</p>
    <dl>
      <div><dt>Size</dt><dd>${photo.width} × ${photo.height}</dd></div>
      <div><dt>Shape</dt><dd>${(photo.width / photo.height).toFixed(2)} : 1</dd></div>
    </dl>`;
  card.querySelector("h3")!.textContent = photo.title;
  const link = card.querySelector("a")!;
  link.href = photo.url;
  link.textContent = photo.author;
  template.content.append(card);
  return template;
}

/** Fills an `<fluidbox-gallery>` with one `<fluidbox-item>` per photo, laid out as justified rows. */
export function mountElements(gallery: HTMLElement): void {
  for (const photo of photos) {
    const item = document.createElement("fluidbox-item");
    item.setAttribute("item-id", photo.id);
    item.style.setProperty("--ratio", String(photo.width / photo.height));

    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.slot = "trigger";
    // The rounded button clips the image, so it is the handoff box rather than the bare <img>.
    trigger.dataset.fluidboxPreview = "";
    trigger.append(image(photo, photoThumb(photo)));

    const content = document.createElement("template");
    content.setAttribute("slot", "content");
    content.content.append(image(photo, photoSrc(photo)));

    item.append(trigger, content, sheetTemplate(photo));
    gallery.append(item);
  }
}

const persisted = ["sheet", "dismiss", "photo", "backdrop", "zoom", "filmstrip", "radius"];

/** A form field's value as the URL keeps it: a checkbox is "on" or "off". */
function read(form: HTMLFormElement, name: string) {
  const field = form.elements.namedItem(name) as RadioNodeList | HTMLInputElement;
  if (field instanceof HTMLInputElement && field.type === "checkbox") {
    return field.checked ? "on" : "off";
  }
  return field.value;
}

function write(form: HTMLFormElement, name: string, value: string) {
  const field = form.elements.namedItem(name) as RadioNodeList | HTMLInputElement;
  if (field instanceof HTMLInputElement && field.type === "checkbox") {
    field.checked = value === "on";
  } else {
    field.value = value;
  }
}

/**
 * Keeps the options in the URL, so a refresh or a shared link keeps them. Only
 * the ones that differ from the markup's defaults are written.
 */
function persist(form: HTMLFormElement) {
  const defaults = new Map(persisted.map((name) => [name, read(form, name)]));
  const params = new URLSearchParams(location.search);
  for (const name of persisted) {
    const value = params.get(name);
    if (value !== null) write(form, name, value);
  }
  form.addEventListener("input", () => {
    const params = new URLSearchParams(location.search);
    for (const name of persisted) {
      const value = read(form, name);
      if (value === defaults.get(name)) params.delete(name);
      else params.set(name, value);
    }
    const query = params.toString();
    history.replaceState(
      history.state,
      "",
      `${location.pathname}${query ? `?${query}` : ""}${location.hash}`,
    );
  });
}

/** Wires the playground's form to the gallery: add-on children, zoom attributes and page styles. */
export function mountControls(gallery: HTMLElement, form: HTMLFormElement): void {
  const root = document.documentElement;
  const field = <T extends Element | RadioNodeList>(name: string) =>
    form.elements.namedItem(name) as T;
  const value = (name: string) => field<RadioNodeList | HTMLInputElement>(name).value;
  const dismiss = field<HTMLSelectElement>("dismiss");
  const photo = field<HTMLSelectElement>("photo");
  const radiusValue = field<HTMLOutputElement>("radiusValue");

  const filmstrip = document.createElement("fluidbox-filmstrip");
  const sheet = document.createElement("fluidbox-sheet");
  sheet.setAttribute("snap-points", "content");
  const viewer = document.createElement("template");
  viewer.setAttribute("slot", "viewer");
  viewer.innerHTML = `<fluidbox-controls></fluidbox-controls>
    <button type="button" class="info-toggle" data-fluidbox-sheet-stop="1">Info</button>`;

  // Adding or removing an add-on rebuilds the viewer, so only touch the ones that changed.
  const toggle = (child: Element, on: boolean) => {
    if (on && !child.isConnected) gallery.append(child);
    if (!on && child.isConnected) child.remove();
  };

  const apply = () => {
    const sheetOn = value("sheet") === "on";
    dismiss.disabled = !sheetOn;
    photo.disabled = !sheetOn;
    root.dataset.sheetPhoto = photo.value;
    if (sheet.getAttribute("dismiss") !== dismiss.value)
      sheet.setAttribute("dismiss", dismiss.value);
    toggle(sheet, sheetOn);
    toggle(viewer, sheetOn);
    toggle(filmstrip, field<HTMLInputElement>("filmstrip").checked);

    const zoom = value("zoom");
    if (zoom === "off") gallery.setAttribute("zoom", "off");
    else {
      gallery.removeAttribute("zoom");
      if (gallery.getAttribute("zoom-max") !== zoom) gallery.setAttribute("zoom-max", zoom);
    }

    root.dataset.backdrop = value("backdrop");
    const radius = `${value("radius")}px`;
    radiusValue.value = radius;
    gallery.style.setProperty("--fb-image-radius", radius);
  };

  persist(form);
  form.addEventListener("input", apply);
  form.addEventListener("submit", (event) => event.preventDefault());
  apply();
}
