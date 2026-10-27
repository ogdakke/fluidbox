// #region example
import { Component } from "@angular/core";
import { itemLabel } from "@ogdakke/fluidbox";
import { FluidboxModule, injectFluidbox } from "@ogdakke/fluidbox/angular";
import { photos } from "../shared";

/** Your own controls and caption. In the viewer, it injects the fluidbox of the root. */
@Component({
  selector: "div[appCaption]",
  standalone: true,
  imports: [FluidboxModule],
  host: { class: "pattern-caption" },
  template: `
    <button
      type="button"
      data-test="prev"
      [disabled]="!fluidbox().hasPrevious"
      (click)="fluidbox().previous()"
    >
      Previous
    </button>
    <span>
      <strong data-test="title">{{ title() }}</strong>
      <small data-test="counter"><span fluidboxCounter></span></small>
    </span>
    <button
      type="button"
      data-test="next"
      [disabled]="!fluidbox().hasNext"
      (click)="fluidbox().next()"
    >
      Next
    </button>
    <button type="button" data-test="close" (click)="fluidbox().close()">Close</button>
  `,
})
export class Caption {
  readonly fluidbox = injectFluidbox();
  readonly title = injectFluidbox(({ item }) => (item ? itemLabel(item) : ""));
}

@Component({
  selector: "pattern-headless",
  standalone: true,
  imports: [FluidboxModule, Caption],
  template: `
    <div fluidboxRoot [items]="photos" class="pattern-grid">
      @for (photo of photos; track photo.id) {
        <button [fluidboxTrigger]="photo.id" class="pattern-thumb" data-test="trigger">
          <img [src]="photo.src" [alt]="label(photo)" />
        </button>
      }
      <!-- A viewer template replaces the default controls. -->
      <ng-template fluidboxViewer>
        <div appCaption></div>
      </ng-template>
    </div>
  `,
})
export class Headless {
  readonly photos = photos;
  readonly label = itemLabel;
}
// #endregion example
