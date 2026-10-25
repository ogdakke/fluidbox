/** The embed add-on's part: `<fluidbox-embed />` in a slide draws a video that loads its player on Play. */
import {
  Component,
  type ElementRef,
  ViewChild,
  computed,
  input,
  signal,
  untracked,
  type AfterContentInit,
} from "@angular/core";
import {
  createEmbedSlide,
  type FluidboxEmbedItem,
  type FluidboxEmbedProvider,
} from "@ogdakke/fluidbox/embed";
import { FluidboxMediaDirective } from "./slide.js";

/**
 * Draw the slide's embed item: its poster and a Play button, then the
 * player. Content becomes the Play button's, and the label its `aria-label`.
 *
 * ```html
 * <ng-template fluidboxSlide="embed"><fluidbox-embed /></ng-template>
 * ```
 */
@Component({
  selector: "fluidbox-embed",
  standalone: true,
  imports: [FluidboxMediaDirective],
  host: { hidden: "" },
  template: `<span #play data-fluidbox-mount><ng-content /></span>
    <ng-template fluidboxMedia [render]="render()" />`,
})
export class FluidboxEmbed implements AfterContentInit {
  /** The providers the slide plays. Compared by name. @default [youtube, vimeo] */
  readonly providers = input<readonly FluidboxEmbedProvider[]>();
  /** The Play button's name, and its text when it has no content. */
  readonly label = input<(item: FluidboxEmbedItem) => string>();
  @ViewChild("play", { static: true }) private readonly play!: ElementRef<HTMLElement>;
  readonly #playable = signal(false);
  readonly #providersKey = computed(() =>
    this.providers()
      ?.map((provider) => provider.name)
      .join(" "),
  );
  readonly #labelled = computed(() => !!this.label());
  protected readonly render = computed(() => {
    this.#providersKey();
    // The newest label names the button, without drawing the embed again.
    const labelled = this.#labelled();
    const playable = this.#playable();
    return createEmbedSlide({
      providers: untracked(this.providers),
      label: labelled ? (item) => this.label()!(item) : undefined,
      play: playable ? () => this.play.nativeElement : undefined,
    });
  });

  // The content has been projected by now, before the box draws.
  ngAfterContentInit(): void {
    const play = this.play.nativeElement;
    this.#playable.set(
      [...play.childNodes].some(
        (node) => node.nodeType === 1 || (node.nodeType === 3 && node.textContent?.trim()),
      ),
    );
  }
}
