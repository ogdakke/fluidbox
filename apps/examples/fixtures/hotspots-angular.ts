import "@angular/compiler";
import { mountSite } from "../src/site";
import { Component, provideZonelessChangeDetection, signal } from "@angular/core";
import { bootstrapApplication } from "@angular/platform-browser";
import { FluidboxModule } from "@ogdakke/fluidbox/angular";
import "@ogdakke/fluidbox/baseline.css";
import "./media.css";
import "./hotspots.css";
import { rooms, withLamp } from "./hotspot-items";

mountSite("fixtures", {
  fixture: "Angular hotspots · button[fluidboxHotspot] pins inside fluidboxMedia",
});

@Component({
  selector: "angular-hotspots",
  standalone: true,
  imports: [FluidboxModule],
  host: { style: "display: contents" },
  template: `
    <div fluidboxRoot [items]="rooms">
      @for (item of rooms; track item.id) {
        <button [fluidboxTrigger]="item.id" [attr.data-item]="item.id">
          <img alt="" [src]="item.thumbnail!.src" />
        </button>
      }
      <ng-template fluidboxSlide="room" let-item>
        <ng-template fluidboxMedia>
          <fluidbox-image [item]="item.image" />
          @for (part of parts(); track part.id) {
            @if (part.id !== "books") {
              <button
                fluidboxHotspot
                [x]="part.x"
                [y]="part.y"
                class="hotspot-pin"
                [attr.data-pin]="part.name"
                [attr.aria-label]="part.name"
              >
                <span aria-hidden="true">+</span>
              </button>
            } @else {
              <!-- The bare attribute reads as true. -->
              <button
                fluidboxHotspot
                [x]="part.x"
                [y]="part.y"
                scaleWithZoom
                class="hotspot-pin"
                [attr.data-pin]="part.name"
                [attr.aria-label]="part.name"
              >
                <span aria-hidden="true">+</span>
              </button>
            }
          }
        </ng-template>
      </ng-template>
    </div>
  `,
})
class Hotspots {
  readonly rooms = rooms;
  readonly parts = signal(rooms[0]!.parts);

  constructor() {
    window.addLamp = () => this.parts.update(withLamp);
  }
}

document.querySelector("#root")!.append(document.createElement("angular-hotspots"));
void bootstrapApplication(Hotspots, { providers: [provideZonelessChangeDetection()] });
