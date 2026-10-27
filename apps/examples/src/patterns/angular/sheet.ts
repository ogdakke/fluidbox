// #region example
import { Component, Input } from "@angular/core";
import { itemLabel } from "@ogdakke/fluidbox";
import {
  FluidboxModule,
  injectFluidboxSheet,
  type FluidboxImageItem,
} from "@ogdakke/fluidbox/angular";
import "@ogdakke/fluidbox/sheet.css";
import "@ogdakke/fluidbox/baseline.css";
import { photos } from "../shared";

@Component({
  selector: "div[appDetails]",
  standalone: true,
  host: { class: "pattern-sheet" },
  template: `
    <h3 data-test="sheet-title">{{ label(photo) }}</h3>
    <p>
      Snap <output data-test="stop">{{ sheet.snap() }}</output>
    </p>
    <button type="button" data-test="expand" (click)="sheet.setSnap(2)">Expand</button>
    <input data-test="field" placeholder="Add a note" aria-label="Note" />
  `,
})
export class Details {
  @Input({ required: true }) photo!: FluidboxImageItem;
  readonly sheet = injectFluidboxSheet();
  readonly label = itemLabel;
}

@Component({
  selector: "pattern-sheet",
  standalone: true,
  imports: [FluidboxModule, Details],
  template: `
    <div fluidboxRoot [items]="photos" class="pattern-grid">
      @for (photo of photos; track photo.id) {
        <button [fluidboxTrigger]="photo.id" class="pattern-thumb" data-test="trigger">
          <img [src]="photo.src" [alt]="label(photo)" />
        </button>
      }
      <!-- Snap 0 rests below the photo; snaps 1 and 2 raise it to 40% and 90% of the screen. -->
      <ng-template fluidboxSheet [snapPoints]="['40%', '90%']" let-photo>
        <div appDetails [photo]="photo"></div>
      </ng-template>
      <ng-template fluidboxViewer>
        <div fluidboxToolbar></div>
        <!-- A fluidboxSheetSnap button moves the sheet to that snap. -->
        <button fluidboxSheetSnap="1" class="pattern-sheet-toggle" data-test="peek">Details</button>
      </ng-template>
    </div>
  `,
})
export class Sheet {
  readonly photos = photos;
  readonly label = itemLabel;
}
// #endregion example
