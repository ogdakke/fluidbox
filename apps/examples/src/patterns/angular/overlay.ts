// #region example
import { Component } from "@angular/core";
import { itemLabel } from "@ogdakke/fluidbox";
import { FluidboxModule } from "@ogdakke/fluidbox/angular";
import { album } from "../shared";

@Component({
  selector: "pattern-overlay",
  standalone: true,
  imports: [FluidboxModule],
  template: `
    <div fluidboxRoot [items]="album">
      <!-- The cover opens the first photo; every one of them closes back onto it. -->
      <button
        [fluidboxTrigger]="album[0]"
        [fluidboxReturns]="album"
        #trigger="fluidboxTrigger"
        class="pattern-thumb pattern-album"
        data-test="trigger"
      >
        <img
          [src]="(trigger.preview().item ?? album[0]).src"
          [alt]="label(trigger.preview().item ?? album[0])"
          data-test="preview"
        />
        <!-- The count flies with the photo, rendered live from its template. -->
        <span fluidboxThumbnailOverlay travel class="pattern-overlay" data-test="count">
          <ng-template>+{{ album.length - 1 }}</ng-template>
        </span>
      </button>
    </div>
  `,
})
export class Overlay {
  readonly album = album;
  readonly label = itemLabel;
}
// #endregion example
