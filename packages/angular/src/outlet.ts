import {
  Component,
  Directive,
  ViewContainerRef,
  inject,
  input,
  type EmbeddedViewRef,
  type OnChanges,
  type OnDestroy,
  type TemplateRef,
} from "@angular/core";

/**
 * Render a template here with a context, as `ngTemplateOutlet` does, without
 * the binding needing `@angular/common`. A new context's values go into the
 * view the template rendered.
 */
@Directive({ selector: "ng-container[fluidboxOutlet]", standalone: true })
export class FluidboxOutletDirective implements OnChanges, OnDestroy {
  readonly fluidboxOutlet = input<TemplateRef<unknown> | null | undefined>(undefined);
  readonly fluidboxOutletContext = input<object | null | undefined>(undefined);
  readonly #container = inject(ViewContainerRef);
  #template: TemplateRef<unknown> | null | undefined;
  #view: EmbeddedViewRef<Record<string, unknown>> | undefined;

  ngOnChanges(): void {
    const template = this.fluidboxOutlet();
    const context = { ...this.fluidboxOutletContext() } as Record<string, unknown>;
    if (template !== this.#template) {
      this.#template = template;
      this.#container.clear();
      this.#view = template
        ? (this.#container.createEmbeddedView(template, context) as EmbeddedViewRef<
            Record<string, unknown>
          >)
        : undefined;
      return;
    }
    // The view reads its context object, and is checked after this.
    if (this.#view) Object.assign(this.#view.context, context);
  }

  ngOnDestroy(): void {
    this.#container.clear();
  }
}

/**
 * A wrapper the status parts render their template in: `aria-hidden` for
 * Loading, which the slide's `aria-busy` already says, and the attribute the
 * stylesheet hides the default error by for Error.
 */
@Component({
  selector: "div[fluidboxBlock]",
  standalone: true,
  imports: [FluidboxOutletDirective],
  template: `<ng-container [fluidboxOutlet]="template" [fluidboxOutletContext]="context" />`,
})
export class FluidboxBlockComponent {
  template: TemplateRef<unknown> | null = null;
  context: object = {};
}
