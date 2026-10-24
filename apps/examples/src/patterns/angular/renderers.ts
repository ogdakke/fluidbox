// #region example
import { Component, InjectionToken, inject } from "@angular/core";
import { itemLabel } from "@ogdakke/fluidbox";
import { FluidboxModule } from "@ogdakke/fluidbox/angular";
import { media, theme, thumbnailSrc } from "../shared";

export const THEME = new InjectionToken<string>("THEME");

/** Custom content renders inside the root, so it injects from the app. */
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
  imports: [FluidboxModule],
  providers: [{ provide: THEME, useValue: theme }],
  template: `
    <!-- Items of type "note" render <article appNote>. -->
    <div fluidboxRoot [items]="media" [renderers]="renderers" class="pattern-grid">
      @for (item of media; track item.id) {
        <button [fluidboxTrigger]="item" class="pattern-thumb" data-test="trigger">
          <img [src]="thumbnailSrc(item)" [alt]="label(item)" />
        </button>
      }
    </div>
  `,
})
export class Renderers {
  readonly media = media;
  readonly renderers = { note: Note };
  readonly label = itemLabel;
  readonly thumbnailSrc = thumbnailSrc;
}
// #endregion example
