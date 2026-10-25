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
        [fluidboxTrigger]="albumIds"
        #trigger="fluidboxTrigger"
        class="pattern-thumb pattern-album"
        data-test="trigger"
      >
        @let shown = trigger.preview().item ?? album[0];
        <img [src]="shown.src" [alt]="label(shown)" data-test="preview" />
        <!-- The count flies with the photo, rendered live from its template. -->
        <span fluidboxOverlay flight="live" class="pattern-overlay" data-test="count">
          <ng-template>+{{ album.length - 1 }}</ng-template>
        </span>
      </button>
    </div>
  `,
})
export class Overlay {
  readonly album = album;
  readonly albumIds = album.map((photo) => photo.id);
  readonly label = itemLabel;
}
// #endregion example
