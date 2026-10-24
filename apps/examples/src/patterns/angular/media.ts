// #region example
import {
  Component,
  Directive,
  ElementRef,
  Input,
  inject,
  type OnDestroy,
  type OnInit,
} from "@angular/core";
import { itemLabel, type FluidboxItem, type FluidboxSlideRenderer } from "@ogdakke/fluidbox";
import { FluidboxModule } from "@ogdakke/fluidbox/angular";
import { embedSlide } from "@ogdakke/fluidbox/embed";
import { createModelSlide } from "@ogdakke/fluidbox/model";
import { createSpinSlide } from "@ogdakke/fluidbox/spin";
import { modelViewerUrl, productMedia, thumbnailSrc } from "../shared";
import { addonSlide } from "../../addon-slide";

/**
 * The add-ons draw into an element. An Angular slide is a component that gets
 * `item`, `index` and `active` inputs, so it draws the add-on into its own
 * element and passes `active` on to the add-on as it changes.
 */
@Directive()
abstract class AddonSlide implements OnInit, OnDestroy {
  protected abstract readonly render: FluidboxSlideRenderer<any>;
  @Input({ required: true }) item!: FluidboxItem;
  @Input() index = 0;
  @Input() set active(active: boolean) {
    if (active === this.#active) return;
    this.#active = active;
    for (const listener of this.#listeners) listener(active);
  }
  get active() {
    return this.#active;
  }
  #active = false;
  readonly #listeners = new Set<(active: boolean) => void>();
  readonly #host = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly #controller = new AbortController();
  #dispose: void | (() => void) = undefined;

  ngOnInit() {
    const active = () => this.#active;
    this.#dispose = this.render(
      addonSlide(
        {
          item: this.item,
          index: this.index,
          get active() {
            return active();
          },
          onActiveChange: (listener) => {
            this.#listeners.add(listener);
            return () => this.#listeners.delete(listener);
          },
        },
        this.#host.nativeElement,
        this.#controller.signal,
      ),
    );
  }

  ngOnDestroy() {
    this.#controller.abort();
    this.#dispose?.();
  }
}

const slide = { standalone: true, host: { style: "display: contents" }, template: "" };

@Component({ ...slide, selector: "span[appEmbedSlide]" })
export class EmbedSlide extends AddonSlide {
  protected readonly render = embedSlide;
}

@Component({ ...slide, selector: "span[appSpinSlide]" })
export class SpinSlide extends AddonSlide {
  protected readonly render = createSpinSlide();
}

@Component({ ...slide, selector: "span[appModelSlide]" })
export class ModelSlide extends AddonSlide {
  // <model-viewer> loads when a model first comes on show.
  protected readonly render = createModelSlide({
    load: () => import(/* @vite-ignore */ modelViewerUrl),
  });
}

@Component({
  selector: "pattern-media",
  standalone: true,
  imports: [FluidboxModule],
  template: `
    <div fluidboxRoot [items]="media" [renderers]="renderers" class="pattern-grid">
      @for (item of media; track item.id) {
        <button [fluidboxTrigger]="item" class="pattern-thumb" data-test="trigger">
          <img [src]="thumbnailSrc(item)" [alt]="label(item)" />
        </button>
      }
    </div>
  `,
})
export class Media {
  readonly media = productMedia;
  // The items' types name these slides: "embed", "spin" and "model".
  readonly renderers = { embed: EmbedSlide, spin: SpinSlide, model: ModelSlide };
  readonly label = itemLabel;
  readonly thumbnailSrc = thumbnailSrc;
}
// #endregion example
