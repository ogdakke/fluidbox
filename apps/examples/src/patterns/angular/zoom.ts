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
        <button [fluidboxTrigger]="photo.id" class="pattern-thumb" data-test="trigger">
          <img [src]="thumbnailSrc(photo)" [alt]="label(photo)" />
        </button>
      }
      <ng-template fluidboxViewer>
        <!-- Previous, Next and Close, then Zoom in, Zoom out and Fit with your icons. -->
        <div fluidboxToolbar></div>
        <div fluidboxZoomControls>
          <button fluidboxZoomIn>
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
              <path [attr.d]="icons.zoomIn" fill="none" stroke="currentColor" stroke-width="2" />
            </svg>
          </button>
          <button fluidboxZoomOut>
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
              <path [attr.d]="icons.zoomOut" fill="none" stroke="currentColor" stroke-width="2" />
            </svg>
          </button>
          <button fluidboxZoomReset>
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
              <path [attr.d]="icons.zoomReset" fill="none" stroke="currentColor" stroke-width="2" />
            </svg>
          </button>
        </div>
        <output appZoomLevel></output>
      </ng-template>
    </div>
    <div fluidboxRoot [items]="photos" [zoom]="false" class="pattern-grid">
      @for (photo of photos; track photo.id) {
        <button [fluidboxTrigger]="photo.id" class="pattern-thumb" data-test="trigger">
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
  // Your own icons: the package ships none. The buttons take their names from the labels.
  readonly icons = {
    zoomIn: "M12 5v14M5 12h14",
    zoomOut: "M5 12h14",
    zoomReset: "M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5",
  };
}
// #endregion example
