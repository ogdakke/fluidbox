// Framework tabs: one choice for every tab group on every page, remembered across visits.
// The selected framework's live example mounts beside its code.
import { frameworks, type Framework } from "./frameworks";

type Mount = (root: HTMLElement) => void | (() => void);
type PatternModule = { patterns: Record<string, Mount> };

const live: Record<Framework, () => Promise<PatternModule>> = {
  react: () => import("../../examples/src/patterns/react/index"),
  vue: () => import("../../examples/src/patterns/vue/index"),
  solid: () => import("../../examples/src/patterns/solid/index"),
  angular: () => import("../../examples/src/patterns/angular/index"),
  elements: () => import("../../examples/src/patterns/elements/index"),
  javascript: () => import("../../examples/src/patterns/javascript/index"),
};

const STORAGE_KEY = "fluidbox-docs-framework";
const isFramework = (value: unknown): value is Framework =>
  frameworks.some((framework) => framework.key === value);

function storedFramework(): Framework {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (isFramework(value)) return value;
  } catch {
    // Storage can be unavailable; the first tab is the default.
  }
  return frameworks[0].key;
}

function storeFramework(framework: Framework) {
  try {
    localStorage.setItem(STORAGE_KEY, framework);
  } catch {
    // Not remembered this time.
  }
}

const unmounts = new Map<HTMLElement, () => void>();

/** Unmount every live example in a container, before it is replaced. */
export function unmountTabs() {
  for (const unmount of unmounts.values()) unmount();
  unmounts.clear();
}

async function mountLive(group: HTMLElement, framework: Framework) {
  const pattern = group.dataset.pattern;
  const slot = group.querySelector<HTMLElement>(".doc-live");
  if (!pattern || !slot) return;
  unmounts.get(slot)?.();
  unmounts.delete(slot);
  const root = document.createElement("div");
  root.className = "pattern";
  root.dataset.pattern = pattern;
  slot.replaceChildren(root);
  slot.dataset.framework = framework;
  try {
    const { patterns } = await live[framework]();
    // The tab or page may have changed while the module loaded.
    if (!root.isConnected || slot.dataset.framework !== framework) return;
    const unmount = patterns[pattern]?.(root);
    unmounts.set(slot, () => {
      try {
        unmount?.();
      } finally {
        root.remove();
      }
    });
  } catch (error) {
    console.error(error);
    slot.innerHTML = '<p class="doc-live__hint">The live example failed to load.</p>';
  }
}

function select(group: HTMLElement, framework: Framework, mount: boolean) {
  for (const tab of group.querySelectorAll<HTMLButtonElement>('[role="tab"]')) {
    const selected = tab.dataset.framework === framework;
    tab.setAttribute("aria-selected", String(selected));
    tab.tabIndex = selected ? 0 : -1;
  }
  for (const panel of group.querySelectorAll<HTMLElement>('[role="tabpanel"]')) {
    panel.hidden = panel.dataset.framework !== framework;
  }
  if (mount) void mountLive(group, framework);
}

/** Wire every tab group in a container to the remembered framework. */
export function mountTabs(container: ParentNode) {
  const framework = storedFramework();
  for (const group of container.querySelectorAll<HTMLElement>(".doc-tabs")) {
    select(group, framework, true);
  }
}

function selectEverywhere(framework: Framework) {
  storeFramework(framework);
  for (const group of document.querySelectorAll<HTMLElement>(".doc-tabs")) {
    const current = group.querySelector('[role="tab"][aria-selected="true"]');
    select(group, framework, (current as HTMLElement | null)?.dataset.framework !== framework);
  }
}

document.addEventListener("click", (event) => {
  const tab = (event.target as Element).closest<HTMLButtonElement>(".doc-tabs [role='tab']");
  if (tab && isFramework(tab.dataset.framework)) selectEverywhere(tab.dataset.framework);
});

document.addEventListener("keydown", (event) => {
  const tab = (event.target as Element).closest<HTMLButtonElement>(".doc-tabs [role='tab']");
  if (!tab || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
  const tabs = [...tab.parentElement!.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
  const index = tabs.indexOf(tab);
  const next =
    event.key === "Home"
      ? tabs[0]
      : event.key === "End"
        ? tabs.at(-1)
        : tabs[(index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length];
  event.preventDefault();
  next?.focus();
  if (next && isFramework(next.dataset.framework)) selectEverywhere(next.dataset.framework);
});

// Another tab of the docs changed the choice.
addEventListener("storage", (event: StorageEvent) => {
  if (event.key === STORAGE_KEY && isFramework(event.newValue)) {
    for (const group of document.querySelectorAll<HTMLElement>(".doc-tabs")) {
      select(group, event.newValue, true);
    }
  }
});
