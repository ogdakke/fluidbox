// #region example
import { Component, signal } from "@angular/core";
import { FluidboxModule, type FluidboxChangeEvent } from "@ogdakke/fluidbox/angular";
import { label, photos } from "../shared";

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
      (beforeToggle)="log($event)"
      (toggle)="log($event)"
      (beforeItemChange)="guard($event)"
      (itemChange)="log($event)"
      (settle)="log($event)"
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
  readonly label = label;
  readonly locked = signal(false);
  readonly events = signal<string[]>([]);

  log(event: Event): void {
    this.events.update((events) => [...events, event.type].slice(-20));
  }

  // beforeItemChange comes before every move between items; canceling it keeps the viewer still.
  guard(event: FluidboxChangeEvent): void {
    this.log(event);
    if (this.locked()) event.preventDefault();
  }
}
// #endregion example
