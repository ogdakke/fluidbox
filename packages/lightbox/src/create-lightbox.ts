import { DomViewerDriver } from "./dom-viewer-driver";
import type { LightboxController, LightboxItem, LightboxOptions } from "./public-api";
import { ViewerSession } from "./viewer-session";

/** Create a framework-independent lightbox controller and body-level DOM viewer. */
export function createLightbox<TItem extends LightboxItem = LightboxItem>(
  options: LightboxOptions<TItem>,
): LightboxController<TItem> {
  const driver = new DomViewerDriver<TItem>(document, options.zoom, options.renderers);
  const session = new ViewerSession(options, driver);
  driver.connect(session, options.portal, [options.filmstrip, options.sheet]);
  return session;
}
