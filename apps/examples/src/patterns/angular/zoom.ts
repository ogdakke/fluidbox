// #region example
import { Component } from "@angular/core";
import { itemLabel } from "@ogdakke/fluidbox";
import { FluidboxModule } from "@ogdakke/fluidbox/angular";
import { photos } from "../shared";

@Component({
  selector: "pattern-zoom",
  standalone: true,
  imports: [FluidboxModule],
  template: `
    <div fluidboxRoot [items]="photos" [zoom]="{ step: 3, max: 6 }" class="pattern-grid">
      @for (photo of photos; track photo.id) {
        <button [fluidboxTrigger]="photo" class="pattern-thumb" data-test="trigger">
          <img [src]="photo.src" [alt]="label(photo)" />
        </button>
      }
    </div>
    <div fluidboxRoot [items]="photos" [zoom]="false" class="pattern-grid">
      @for (photo of photos; track photo.id) {
        <button [fluidboxTrigger]="photo" class="pattern-thumb" data-test="trigger">
          <img [src]="photo.src" [alt]="label(photo)" />
        </button>
      }
    </div>
  `,
})
export class Zoom {
  readonly photos = photos;
  readonly label = itemLabel;
}
// #endregion example
