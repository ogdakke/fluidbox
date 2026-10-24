import { crossOrigin, downloadName, fileOf } from "./item-file";
import { itemLabel } from "./items";
import type { FluidboxItem } from "./public-api";

function save(ownerDocument: Document, href: string, name: string) {
  const link = ownerDocument.createElement("a");
  link.href = href;
  link.download = name;
  link.hidden = true;
  ownerDocument.body.append(link);
  link.click();
  link.remove();
}

/**
 * Save an item's file. A same-origin file downloads; a cross-origin one is
 * fetched and saved from a blob, and opens in a new tab when it can't be.
 * Resolves whether a download or a tab started.
 */
export async function downloadItem(
  ownerDocument: Document,
  item: FluidboxItem,
  signal: AbortSignal,
  busy: (on: boolean) => void,
): Promise<boolean> {
  const file = fileOf(item);
  if (!file) return false;
  const href = new URL(file.src, location.href).href;
  const name = downloadName(item, file);
  if (!crossOrigin(href)) {
    save(ownerDocument, href, name);
    return true;
  }
  busy(true);
  try {
    const response = await fetch(href, { mode: "cors", signal });
    if (!response.ok) throw new Error(`${response.status}`);
    const url = URL.createObjectURL(await response.blob());
    if (signal.aborted) {
      URL.revokeObjectURL(url);
      return false;
    }
    save(ownerDocument, url, name);
    // The download holds its own reference once it starts.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  } catch {
    if (signal.aborted) return false;
    // Without CORS the browser's own save works, in a tab.
    ownerDocument.defaultView?.open(href, "_blank", "noopener,noreferrer");
    return true;
  } finally {
    busy(false);
  }
}

/**
 * Share a link to an item through the share sheet, else copy it. Resolves
 * whether it was shared or copied; `copied` runs after a copy.
 */
export async function shareItem(
  item: FluidboxItem,
  url: string,
  copied: () => void,
): Promise<boolean> {
  const data = { title: itemLabel(item), url };
  if (navigator.share && (!navigator.canShare || navigator.canShare(data))) {
    try {
      await navigator.share(data);
      return true;
    } catch (error) {
      // Cancelled, or refused for another reason than permission.
      if ((error as Error | undefined)?.name !== "NotAllowedError") return false;
    }
  }
  if (!navigator.clipboard) return false;
  try {
    await navigator.clipboard.writeText(url);
  } catch {
    return false;
  }
  copied();
  return true;
}
