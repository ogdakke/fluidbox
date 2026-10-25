// #region example
import { Component } from "@angular/core";
import { itemLabel } from "@ogdakke/fluidbox";
import { FluidboxModule } from "@ogdakke/fluidbox/angular";
import "@ogdakke/fluidbox/thumbnails.css";
import "@ogdakke/fluidbox/baseline.css";
import { arabic, photos } from "../shared";

@Component({
  selector: "pattern-rtl",
  standalone: true,
  imports: [FluidboxModule],
  template: `
    <!-- The viewer takes dir and lang from the trigger's surroundings. -->
    <div dir="rtl" lang="ar">
      <div fluidboxRoot [items]="photos" [labels]="labels" class="pattern-grid">
        @for (photo of photos; track photo.id) {
          <button [fluidboxTrigger]="photo.id" class="pattern-thumb" data-test="trigger">
            <img [src]="photo.src" [alt]="label(photo)" />
          </button>
        }
        <ng-container fluidboxThumbnails />
      </div>
    </div>
  `,
})
export class Rtl {
  readonly photos = photos;
  readonly labels = arabic;
  readonly label = itemLabel;
}
// #endregion example
