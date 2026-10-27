// #region example
import { Component, InjectionToken, inject } from "@angular/core";
import { itemLabel } from "@ogdakke/fluidbox";
import { FluidboxModule } from "@ogdakke/fluidbox/angular";
import { media, theme, thumbnailSrc } from "../shared";

export const THEME = new InjectionToken<string>("THEME");

/** Slide content renders inside the root, so it injects from the app. */
@Component({
  selector: "article[appNote]",
  standalone: true,
  host: { class: "pattern-note" },
  template: `Theme: {{ theme }}`,
})
export class Note {
  readonly theme = inject(THEME);
}

@Component({
  selector: "pattern-renderers",
  standalone: true,
  imports: [FluidboxModule, Note],
  providers: [{ provide: THEME, useValue: theme }],
  template: `
    <div fluidboxRoot [items]="media" class="pattern-grid">
      @for (item of media; track item.id) {
        <button [fluidboxTrigger]="item.id" class="pattern-thumb" data-test="trigger">
          <img [src]="thumbnailSrc(item)" [alt]="label(item)" />
        </button>
      }
      <!-- Items of type "note" render <article appNote> in their media box. -->
      <ng-template fluidboxSlide="note">
        <ng-template fluidboxMedia><article appNote></article></ng-template>
      </ng-template>
    </div>
  `,
})
export class Renderers {
  readonly media = media;
  readonly label = itemLabel;
  readonly thumbnailSrc = thumbnailSrc;
}
// #endregion example
