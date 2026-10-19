// #region example
import { Component } from "@angular/core";
import { itemLabel } from "@ogdakke/fluidbox";
import { FluidboxModule } from "@ogdakke/fluidbox/angular";
import { product, strip } from "../shared";

@Component({
  selector: "pattern-origins",
  standalone: true,
  imports: [FluidboxModule],
  template: `
    <!-- The photo flies from the element marked data-fluidbox-origin, not the whole card. -->
    <div fluidboxRoot [items]="[product]">
      <button [fluidboxTrigger]="product" class="pattern-card" data-test="product">
        <span data-fluidbox-origin>
          <img [src]="product.src" [alt]="label(product)" />
        </span>
        <span><strong>Coral runner</strong><br />€120</span>
      </button>
    </div>
    <!-- Moving through the viewer scrolls each trigger into view, so the close lands on it. -->
    <div fluidboxRoot [items]="strip" class="pattern-scroller" data-test="scroller">
      @for (item of strip; track item.id) {
        <button [fluidboxTrigger]="item" class="pattern-thumb" data-test="trigger">
          <img [src]="item.src" [alt]="label(item)" />
        </button>
      }
    </div>
  `,
})
export class Origins {
  readonly product = product;
  readonly strip = strip;
  readonly label = itemLabel;
}
// #endregion example
