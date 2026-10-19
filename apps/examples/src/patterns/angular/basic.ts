// #region example
import { Component } from "@angular/core";
import { FluidboxModule } from "@ogdakke/fluidbox/angular";
import { label, photos } from "../shared";

@Component({
  selector: "pattern-basic",
  standalone: true,
  imports: [FluidboxModule],
  template: `
    <div fluidboxRoot [items]="photos" class="pattern-grid">
      @for (photo of photos; track photo.id) {
        <button [fluidboxTrigger]="photo" class="pattern-thumb" data-test="trigger">
          <img [src]="photo.src" [alt]="label(photo)" />
        </button>
      }
      <!-- Without a viewer template these three are the default; with one, you place them. -->
      <ng-template fluidboxViewer>
        <button fluidboxPrevious></button>
        <button fluidboxNext></button>
        <button fluidboxClose></button>
      </ng-template>
    </div>
  `,
})
export class Basic {
  readonly photos = photos;
  readonly label = label;
}
// #endregion example
