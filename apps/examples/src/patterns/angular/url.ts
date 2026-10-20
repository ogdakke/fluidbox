// #region example
import { Component, HostListener, signal } from "@angular/core";
import { itemLabel } from "@ogdakke/fluidbox";
import { FluidboxModule } from "@ogdakke/fluidbox/angular";
import { photos } from "../shared";

/** The photo in the address: `?photo=2` is the second. */
function photoInUrl(): number | null {
  const photo = Number(new URLSearchParams(location.search).get("photo")) - 1;
  return Number.isInteger(photo) && photo >= 0 && photo < photos.length ? photo : null;
}

/** Put the photo on show in the address. Opening adds an entry, so Back closes the viewer. */
function followInUrl(photo: number | null) {
  const shown = photoInUrl();
  if (photo === shown) return;
  const url = new URL(location.href);
  if (photo === null) {
    // Go back past the entry opening added, or drop the photo from a link you came in on.
    if (history.state?.photo) return history.back();
    url.searchParams.delete("photo");
    return history.replaceState(null, "", url);
  }
  url.searchParams.set("photo", String(photo + 1));
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
      [open]="photo() !== null"
      [index]="photo() ?? undefined"
      (openChange)="onOpenChange($event)"
      (indexChange)="onIndexChange($event)"
      class="pattern-grid"
    >
      @for (photo of photos; track photo.id) {
        <button [fluidboxTrigger]="photo" class="pattern-thumb" data-test="trigger">
          <img [src]="photo.src" [alt]="label(photo)" />
        </button>
      }
    </div>
  `,
})
export class Url {
  readonly photos = photos;
  readonly label = itemLabel;
  readonly photo = signal(photoInUrl());

  @HostListener("window:popstate")
  onPopState() {
    this.photo.set(photoInUrl());
  }

  onOpenChange(open: boolean) {
    if (open) return;
    followInUrl(null);
    this.photo.set(null);
  }

  onIndexChange(index: number) {
    followInUrl(index);
    this.photo.set(index);
  }
}
// #endregion example
