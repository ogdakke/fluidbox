// #region example
import { Component } from "@angular/core";
import { itemLabel } from "@ogdakke/fluidbox";
import { FluidboxModule } from "@ogdakke/fluidbox/angular";
import "@ogdakke/fluidbox/filmstrip.css";
import { photos } from "../shared";

@Component({
  selector: "pattern-filmstrip",
  standalone: true,
  imports: [FluidboxModule],
  template: `
    <div fluidboxRoot [items]="photos" class="pattern-grid">
      @for (photo of photos; track photo.id) {
        <button [fluidboxTrigger]="photo" class="pattern-thumb" data-test="trigger">
          <img [src]="photo.src" [alt]="label(photo)" />
        </button>
      }
      <ng-container fluidboxFilmstrip />
    </div>
    <div fluidboxRoot [items]="photos" class="pattern-grid">
      @for (photo of photos; track photo.id) {
        <button [fluidboxTrigger]="photo" class="pattern-thumb" data-test="trigger">
          <img [src]="photo.src" [alt]="label(photo)" />
        </button>
      }
      <!-- Your own thumbnails. The selected button has data-fluidbox-selected. -->
      <ng-template fluidboxFilmstrip let-index="index">
        <span class="pattern-filmstrip-thumb" data-test="thumb">{{ index + 1 }}</span>
      </ng-template>
    </div>
  `,
})
export class Filmstrip {
  readonly photos = photos;
  readonly label = itemLabel;
}
// #endregion example
