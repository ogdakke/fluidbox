// #region example
import { Component } from "@angular/core";
import { itemLabel } from "@ogdakke/fluidbox";
import { FluidboxModule } from "@ogdakke/fluidbox/angular";
import { FluidboxEmbed } from "@ogdakke/fluidbox/angular/embed";
import { FluidboxModel } from "@ogdakke/fluidbox/angular/model";
import { FluidboxSpin } from "@ogdakke/fluidbox/angular/spin";
import { modelViewerUrl, productMedia, thumbnailSrc } from "../shared";

@Component({
  selector: "pattern-media",
  standalone: true,
  imports: [FluidboxModule, FluidboxEmbed, FluidboxSpin, FluidboxModel],
  template: `
    <div fluidboxRoot [items]="media" class="pattern-grid">
      @for (item of media; track item.id) {
        <button [fluidboxTrigger]="item.id" class="pattern-thumb" data-test="trigger">
          <img [src]="thumbnailSrc(item)" [alt]="label(item)" />
        </button>
      }
      <!-- The photo is built in; the other items' types name these slides. -->
      <ng-template fluidboxSlide="embed"><fluidbox-embed /></ng-template>
      <ng-template fluidboxSlide="spin"><fluidbox-spin /></ng-template>
      <ng-template fluidboxSlide="model"><fluidbox-model [load]="loadModelViewer" /></ng-template>
    </div>
  `,
})
export class Media {
  readonly media = productMedia;
  readonly label = itemLabel;
  readonly thumbnailSrc = thumbnailSrc;
  // <model-viewer> loads when a model first comes on show.
  readonly loadModelViewer = () => import(/* @vite-ignore */ modelViewerUrl);
}
// #endregion example
