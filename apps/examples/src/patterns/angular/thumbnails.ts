// #region example
import { Component } from "@angular/core";
import { itemLabel } from "@ogdakke/fluidbox";
import { FluidboxModule } from "@ogdakke/fluidbox/angular";
import "@ogdakke/fluidbox/thumbnails.css";
import "@ogdakke/fluidbox/baseline.css";
import { photos } from "../shared";

@Component({
  selector: "pattern-thumbnails",
  standalone: true,
  imports: [FluidboxModule],
  template: `
    <div fluidboxRoot [items]="photos" class="pattern-grid">
      @for (photo of photos; track photo.id) {
        <button [fluidboxTrigger]="photo.id" class="pattern-thumb" data-test="trigger">
          <img [src]="photo.src" [alt]="label(photo)" />
        </button>
      }
      <ng-container fluidboxThumbnails />
    </div>
    <div fluidboxRoot [items]="photos" class="pattern-grid">
      @for (photo of photos; track photo.id) {
        <button [fluidboxTrigger]="photo.id" class="pattern-thumb" data-test="trigger">
          <img [src]="photo.src" [alt]="label(photo)" />
        </button>
      }
      <!-- Your own thumbnails. The selected button has data-active. -->
      <ng-template fluidboxThumbnails let-index="index">
        <span class="pattern-thumbnails-thumb" data-test="thumb">{{ index + 1 }}</span>
      </ng-template>
    </div>
  `,
})
export class Thumbnails {
  readonly photos = photos;
  readonly label = itemLabel;
}
// #endregion example
