// A copy button on every code block, on every page of both sites, including
// blocks that arrive later (a docs page rendered on navigation, a pattern's
// code panel). Readouts that only look like code opt out with data-no-copy.
import { uiIcon } from "./icons";

const CODE_BLOCKS = "pre:has(> code), pre.highlights";
/** Wrappers that already frame one code block; the button goes in their corner. */
const FRAMES = ".doc-code, .fb-code, .fb-copy-host";

function frameFor(pre: HTMLPreElement): HTMLElement {
  const parent = pre.parentElement;
  if (parent?.matches(FRAMES)) return parent;
  const host = document.createElement("div");
  host.className = "fb-copy-host";
  pre.replaceWith(host);
  host.append(pre);
  return host;
}

function addButton(pre: HTMLPreElement) {
  if (pre.closest("[data-no-copy]")) return;
  const frame = frameFor(pre);
  if (frame.querySelector(":scope > .fb-copy")) return;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "fb-copy";
  button.innerHTML = `${uiIcon("copy")}<span>Copy</span>`;
  button.setAttribute("aria-label", "Copy code");
  frame.append(button);
}

/** The code is the block's text, without the trailing newline a highlighter keeps. */
const codeOf = (frame: Element) =>
  (frame.querySelector("pre")?.textContent ?? "").replace(/\n$/, "");

async function write(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Without a secure context the Clipboard API is missing; select and copy instead.
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.cssText = "position:fixed;opacity:0;pointer-events:none";
    document.body.append(area);
    area.select();
    const copied = document.execCommand("copy");
    area.remove();
    return copied;
  }
}

const resets = new WeakMap<HTMLButtonElement, number>();

async function copy(button: HTMLButtonElement) {
  const frame = button.parentElement;
  if (!frame) return;
  const copied = await write(codeOf(frame));
  const label = button.querySelector("span")!;
  const use = button.querySelector("use")!;
  use.setAttribute("href", `/icons/ui.svg#${copied ? "check" : "copy"}`);
  label.textContent = copied ? "Copied" : "Failed";
  button.setAttribute("aria-label", copied ? "Copied" : "Failed");
  button.dataset.copied = String(copied);
  clearTimeout(resets.get(button));
  resets.set(
    button,
    window.setTimeout(() => {
      use.setAttribute("href", "/icons/ui.svg#copy");
      label.textContent = "Copy";
      button.setAttribute("aria-label", "Copy code");
      delete button.dataset.copied;
    }, 1600),
  );
}

let started = false;

/** Put a copy button on every code block, now and as more arrive. */
export function mountCopyButtons(root: ParentNode = document) {
  for (const pre of root.querySelectorAll<HTMLPreElement>(CODE_BLOCKS)) addButton(pre);
  if (started) return;
  started = true;
  document.addEventListener("click", (event) => {
    const button = (event.target as Element).closest<HTMLButtonElement>(".fb-copy");
    if (button) void copy(button);
  });
  let queued = false;
  new MutationObserver(() => {
    if (queued) return;
    queued = true;
    queueMicrotask(() => {
      queued = false;
      for (const pre of document.querySelectorAll<HTMLPreElement>(CODE_BLOCKS)) addButton(pre);
    });
  }).observe(document.body, { childList: true, subtree: true });
}
