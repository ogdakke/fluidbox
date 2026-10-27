// Fullscreen, download and share: what a few viewers use, loaded once one does.
// The driver resolves what they need, so this chunk imports nothing of the core's.

type FullscreenDocument = Document & { webkitExitFullscreen?: () => void };

/** Viewers that left the top layer as a popover to go fullscreen, and go back on leaving. */
const lowered = new WeakSet<HTMLElement>();

/**
 * Make the viewer fill the screen. Over a modal dialog the viewer is a popover
 * in the top layer, which browsers disagree about taking fullscreen, so it
 * stops being one first; fullscreen keeps it above the dialog by itself.
 * Resolves whether it went.
 */
export async function enterFullscreen(overlay: HTMLElement): Promise<boolean> {
  const element = overlay as HTMLElement & { webkitRequestFullscreen?: () => void };
  if (!overlay.isConnected) return false;
  const focused = overlay.ownerDocument.activeElement;
  if (overlay.hasAttribute("popover")) {
    overlay.hidePopover();
    overlay.removeAttribute("popover");
    lowered.add(overlay);
  }
  try {
    if (element.requestFullscreen) await element.requestFullscreen();
    else element.webkitRequestFullscreen?.();
  } catch {
    raiseAgain(overlay);
    return false;
  } finally {
    // Hiding the popover may have moved focus out of it.
    if (focused instanceof HTMLElement && focused !== overlay.ownerDocument.activeElement) {
      focused.focus({ preventScroll: true });
    }
  }
  return true;
}

/** Leave fullscreen, waiting for it at most 500 ms. */
export function exitFullscreen(overlay: HTMLElement): Promise<void> {
  const ownerDocument = overlay.ownerDocument as FullscreenDocument;
  return new Promise<void>((resolve) => {
    const done = new AbortController();
    const finish = () => {
      clearTimeout(timer);
      done.abort();
      resolve();
    };
    const timer = setTimeout(finish, 500);
    for (const type of ["fullscreenchange", "webkitfullscreenchange"]) {
      ownerDocument.addEventListener(type, finish, { signal: done.signal });
    }
    try {
      if (ownerDocument.exitFullscreen) void ownerDocument.exitFullscreen().catch(finish);
      else ownerDocument.webkitExitFullscreen?.();
    } catch {
      finish();
    }
  });
}

/** Back into the top layer as a popover, as the viewer was before it went fullscreen. */
export function raiseAgain(overlay: HTMLElement) {
  if (!lowered.delete(overlay)) return;
  overlay.popover = "manual";
  if (overlay.isConnected) overlay.showPopover();
}

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
 * Save a file as `name`. A same-origin file downloads; a cross-origin one is
 * fetched and saved from a blob, and opens in a new tab when it can't be.
 * Resolves whether a download or a tab started.
 */
export async function saveFile(
  ownerDocument: Document,
  href: string,
  name: string,
  offsite: boolean,
  signal: AbortSignal,
  busy: (on: boolean) => void,
): Promise<boolean> {
  if (!offsite) {
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
 * Share a link through the share sheet, else copy it. Resolves whether it was
 * shared or copied; `copied` runs after a copy.
 */
export async function shareLink(title: string, url: string, copied: () => void): Promise<boolean> {
  const data = { title, url };
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
