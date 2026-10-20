import "@angular/compiler";
import { Component, provideZonelessChangeDetection, signal } from "@angular/core";
import { bootstrapApplication } from "@angular/platform-browser";
import type { FluidboxLabels } from "@ogdakke/fluidbox";
import { FluidboxModule } from "@ogdakke/fluidbox/angular";
import { album, countText, coverAlt, customViewerText, type MountLive } from "./shared";

@Component({
  selector: "binding-live",
  standalone: true,
  imports: [FluidboxModule],
  template: `
    <div fluidboxRoot [items]="album" [labels]="labels()" [loop]="loop()">
      <button [fluidboxTrigger]="album[0]" class="pattern-thumb pattern-album" data-test="trigger">
        <img [src]="album[0].src" [alt]="coverAlt" />
        <span fluidboxThumbnailOverlay travel class="pattern-overlay" data-test="count">
          <ng-template
            ><span fluidboxFrameLayer class="live-layer" data-test="layer"></span
            >{{ countText }}</ng-template
          >
        </span>
      </button>
      <ng-container fluidboxFilmstrip />
      @if (viewer()) {
        <ng-template fluidboxViewer>
          <p class="live-viewer" data-test="custom-viewer">{{ customViewerText }}</p>
        </ng-template>
      }
    </div>
  `,
})
class Live {
  readonly album = album;
  readonly coverAlt = coverAlt;
  readonly countText = countText;
  readonly customViewerText = customViewerText;
  readonly labels = signal<Partial<FluidboxLabels> | undefined>(undefined);
  readonly viewer = signal(false);
  readonly loop = signal(false);
}

export const mount: MountLive = async (root) => {
  root.append(document.createElement("binding-live"));
  const app = await bootstrapApplication(Live, {
    providers: [provideZonelessChangeDetection()],
  });
  const live = app.components[0]!.instance as Live;
  return {
    setLabels: (next) => live.labels.set(next),
    setViewer: (on) => live.viewer.set(on),
    setLoop: (on) => live.loop.set(on),
  };
};
