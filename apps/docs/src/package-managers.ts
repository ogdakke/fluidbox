// Package-manager tabs on install commands: one choice for every switcher on every page,
// remembered across visits, as the framework tabs are.
const managers = ["npm", "pnpm", "yarn", "bun"] as const;
type PackageManager = (typeof managers)[number];

const STORAGE_KEY = "fluidbox-docs-package-manager";
const isManager = (value: unknown): value is PackageManager =>
  managers.includes(value as PackageManager);

function stored(): PackageManager {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (isManager(value)) return value;
  } catch {
    // Storage can be unavailable; npm is the default.
  }
  return "npm";
}

function store(manager: PackageManager) {
  try {
    localStorage.setItem(STORAGE_KEY, manager);
  } catch {
    // Not remembered this time.
  }
}

function select(group: HTMLElement, manager: PackageManager) {
  for (const tab of group.querySelectorAll<HTMLButtonElement>('[role="tab"]')) {
    const selected = tab.dataset.packageManager === manager;
    tab.setAttribute("aria-selected", String(selected));
    tab.tabIndex = selected ? 0 : -1;
  }
  for (const panel of group.querySelectorAll<HTMLElement>('[role="tabpanel"]')) {
    panel.hidden = panel.dataset.packageManager !== manager;
  }
}

function selectEverywhere(manager: PackageManager) {
  for (const group of document.querySelectorAll<HTMLElement>(".doc-install")) {
    select(group, manager);
  }
}

/** Show every switcher in a container on the remembered package manager. */
export function mountPackageManagers(container: ParentNode) {
  const manager = stored();
  for (const group of container.querySelectorAll<HTMLElement>(".doc-install")) {
    select(group, manager);
  }
}

const tabOf = (event: Event) =>
  (event.target as Element).closest<HTMLButtonElement>(".doc-install [role='tab']");

document.addEventListener("click", (event) => {
  const manager = tabOf(event)?.dataset.packageManager;
  if (!isManager(manager)) return;
  store(manager);
  selectEverywhere(manager);
});

document.addEventListener("keydown", (event) => {
  const tab = tabOf(event);
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
  const manager = next?.dataset.packageManager;
  if (!isManager(manager)) return;
  store(manager);
  selectEverywhere(manager);
});

// Another tab of the docs changed the choice.
addEventListener("storage", (event: StorageEvent) => {
  if (event.key === STORAGE_KEY && isManager(event.newValue)) selectEverywhere(event.newValue);
});
