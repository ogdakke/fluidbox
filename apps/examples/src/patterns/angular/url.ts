// #region example
import { afterNextRender, Component, HostListener, signal } from "@angular/core";
import { itemLabel } from "@ogdakke/fluidbox";
import { FluidboxModule } from "@ogdakke/fluidbox/angular";
import { photos } from "../shared";

/** The photo in the address: `?photo=2` is the second. */
function photoInUrl(): string | null {
  const photo = Number(new URLSearchParams(location.search).get("photo")) - 1;
  return photos[photo]?.id ?? null;
}

/** Put the photo on show in the address. Opening adds an entry, so Back closes the viewer. */
function followInUrl(id: string | null) {
  const shown = photoInUrl();
  if (id === shown) return;
  const url = new URL(location.href);
  if (id === null) {
    // Go back past the entry opening added, or drop the photo from a link you came in on.
    if (history.state?.photo) return history.back();
    url.searchParams.delete("photo");
    return history.replaceState(null, "", url);
  }
  url.searchParams.set("photo", String(photos.findIndex((photo) => photo.id === id) + 1));
  if (shown === null) history.pushState({ photo: true }, "", url);
  else history.replaceState(history.state, "", url);
}

@Component({
  selector: "pattern-url",
  standalone: true,
  imports: [FluidboxModule],
  template: `
    <div
      fluidboxRoot
      [items]="photos"
      [value]="photo()"
      (valueChange)="follow($event)"
      class="pattern-grid"
    >
      @for (photo of photos; track photo.id) {
        <button [fluidboxTrigger]="photo.id" class="pattern-thumb" data-test="trigger">
          <img [src]="photo.src" [alt]="label(photo)" />
        </button>
      }
    </div>
  `,
})
export class Url {
  readonly photos = photos;
  readonly label = itemLabel;
  // Read the address once rendered, so the server and the browser render the same.
  readonly photo = signal<string | null>(null);

  constructor() {
    afterNextRender(() => this.onPopState());
  }

  @HostListener("window:popstate")
  onPopState() {
    this.photo.set(photoInUrl());
  }

  follow(value: string | null) {
    followInUrl(value);
    this.photo.set(value);
  }
}
// #endregion example
