// #region example
import { Component } from "@angular/core";
import { itemLabel } from "@ogdakke/fluidbox";
import { FluidboxModule, injectFluidbox } from "@ogdakke/fluidbox/angular";
import { photos, thumbnailSrc, zoomPhotos } from "../shared";

/** The zoom the image on show rests at. In the viewer, it injects the root's state. */
@Component({
  selector: "output[appZoomLevel]",
  standalone: true,
  host: { class: "pattern-zoom-level", "data-test": "zoom-level" },
  template: `{{ level() }}`,
})
export class ZoomLevel {
  readonly level = injectFluidbox(({ zoom }) => (zoom ? `${Math.round(zoom.scale * 100)}%` : ""));
}

@Component({
  selector: "pattern-zoom",
  standalone: true,
  imports: [FluidboxModule, ZoomLevel],
  template: `
    <!-- Double-click zooms to 3x; pinch, wheel and the controls stop at 6x. -->
    <div fluidboxRoot [items]="zoomPhotos" [zoom]="{ step: 3, max: 6 }" class="pattern-grid">
      @for (photo of zoomPhotos; track photo.id) {
        <button [fluidboxTrigger]="photo" class="pattern-thumb" data-test="trigger">
          <img [src]="thumbnailSrc(photo)" [alt]="label(photo)" />
        </button>
      }
      <ng-template fluidboxViewer>
        <!-- Previous, Next and Close, then Zoom in, Zoom out and Fit. -->
        <div fluidboxControls zoom></div>
        <output appZoomLevel></output>
      </ng-template>
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
  readonly zoomPhotos = zoomPhotos;
  readonly photos = photos;
  readonly label = itemLabel;
  readonly thumbnailSrc = thumbnailSrc;
}
// #endregion example
