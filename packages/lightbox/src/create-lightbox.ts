import { DomViewerDriver } from "./dom-viewer-driver";
import type { LightboxController, LightboxItem, LightboxOptions } from "./public-api";
import { ViewerSession } from "./viewer-session";

/** Plain DOM runtime. Kept internal until its browser interaction gate passes. */
export function createLightbox<TItem extends LightboxItem = LightboxItem>(
  options: LightboxOptions<TItem>,
): LightboxController<TItem> {
  const driver = new DomViewerDriver<TItem>(document);
  const session = new ViewerSession(options, driver);
  driver.connect(session, options.portal);
  return session;
}
