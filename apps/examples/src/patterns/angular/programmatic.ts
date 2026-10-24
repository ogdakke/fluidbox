// #region example
import { Component, signal } from "@angular/core";
import { itemLabel } from "@ogdakke/fluidbox";
import { FluidboxModule, type FluidboxValueChangeEvent } from "@ogdakke/fluidbox/angular";
import { photos } from "../shared";

@Component({
  selector: "pattern-programmatic",
  standalone: true,
  imports: [FluidboxModule],
  template: `
    <div class="pattern-toolbar">
      <button type="button" data-test="open-third" (click)="fb.open(2)">
        Open the third photo
      </button>
      <label>
        <input
          type="checkbox"
          name="lock"
          data-test="lock"
          #lock
          (change)="locked.set(lock.checked)"
        />
        Lock navigation
      </label>
      <output data-test="status">{{ fb.state().status }} {{ fb.state().index ?? "-" }}</output>
    </div>
    <div
      fluidboxRoot
      #fb="fluidbox"
      [items]="photos"
      class="pattern-grid"
      (beforeValueChange)="guard($event)"
      (valueChangeComplete)="log('valuechangecomplete')"
    >
      @for (photo of photos; track photo.id) {
        <button [fluidboxTrigger]="photo" class="pattern-thumb" data-test="trigger">
          <img [src]="photo.src" [alt]="label(photo)" />
        </button>
      }
    </div>
    <ol class="pattern-log" data-test="log">
      @for (type of events(); track $index) {
        <li>{{ type }}</li>
      }
    </ol>
  `,
})
export class Programmatic {
  readonly photos = photos;
  readonly label = itemLabel;
  readonly locked = signal(false);
  readonly events = signal<string[]>([]);

  log(type: string): void {
    this.events.update((events) => [...events, type].slice(-20));
  }

  // Comes before every open, move and close; canceling a move keeps the viewer still.
  guard(event: FluidboxValueChangeEvent): void {
    this.log("valuechange");
    if (this.locked() && event.action === "move") event.preventDefault();
  }
}
// #endregion example
