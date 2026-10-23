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
import { itemLabel, type FluidboxImageItem } from "@ogdakke/fluidbox";
import { hoverZoom } from "@ogdakke/fluidbox/hover-zoom";
import { FluidboxModule } from "@ogdakke/fluidbox/angular";
import { productPhoto, thumbnailSrc } from "../shared";

/** Magnifies its image inside its own box under a resting mouse. */
@Directive({ selector: "img[appHoverZoom]", standalone: true })
export class HoverZoom implements OnInit, OnDestroy {
  @Input({ required: true }) appHoverZoom!: FluidboxImageItem;
  readonly #image = inject<ElementRef<HTMLImageElement>>(ElementRef);
  #stop?: () => void;

  ngOnInit() {
    this.#stop = hoverZoom(this.#image.nativeElement, this.appHoverZoom);
  }

  ngOnDestroy() {
    this.#stop?.();
  }
}

@Component({
  selector: "pattern-hover",
  standalone: true,
  imports: [FluidboxModule, HoverZoom],
  template: `
    <div fluidboxRoot [items]="[photo]">
      <button [fluidboxTrigger]="photo" class="pattern-product" data-test="product">
        <img
          [appHoverZoom]="photo"
          [src]="thumbnailSrc(photo)"
          [alt]="label(photo)"
          width="640"
          height="640"
        />
      </button>
    </div>
  `,
})
export class Hover {
  readonly photo = productPhoto;
  readonly label = itemLabel;
  readonly thumbnailSrc = thumbnailSrc;
}
// #endregion example
