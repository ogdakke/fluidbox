// #region example
import { Component } from "@angular/core";
import { FluidboxModule } from "@ogdakke/fluidbox/angular";
import { album, label } from "../shared";

@Component({
  selector: "pattern-overlay",
  standalone: true,
  imports: [FluidboxModule],
  template: `
    <div fluidboxRoot [items]="album">
      <!-- The first album item opens; every one of them closes back onto this button. -->
      <button
        fluidboxTrigger
        [fluidboxTriggerItems]="album"
        #trigger="fluidboxTrigger"
        class="pattern-thumb pattern-album"
        data-test="trigger"
      >
        <img
          [src]="(trigger.preview().item ?? album[0]).src"
          [alt]="label(trigger.preview().item ?? album[0])"
          data-test="preview"
        />
        <!-- The count flies with the photo. -->
        <span fluidboxThumbnailOverlay travel class="pattern-overlay" data-test="count"
          >+{{ album.length - 1 }}</span
        >
      </button>
    </div>
  `,
})
export class Overlay {
  readonly album = album;
  readonly label = label;
}
// #endregion example
