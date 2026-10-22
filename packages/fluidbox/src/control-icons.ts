/** Stroke paths for the default viewer controls, drawn in a 24×24 box. */
export const CONTROL_ICON_PATHS = {
  close: "M6 6l12 12M18 6L6 18",
  previous: "M14.5 5.5L8 12l6.5 6.5",
  next: "M9.5 5.5L16 12l-6.5 6.5",
  zoomIn: "M5 12h14M12 5v14",
  zoomOut: "M5 12h14",
  zoomReset: "M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5",
} as const;

export type ControlIconPart = keyof typeof CONTROL_ICON_PATHS;

export const CONTROL_ICON_ATTRIBUTES = {
  viewBox: "0 0 24 24",
  width: "20",
  height: "20",
  fill: "none",
  stroke: "currentColor",
  "stroke-width": "2",
  "stroke-linecap": "round",
  "stroke-linejoin": "round",
  "aria-hidden": "true",
} as const;

/** Build a default control icon as a DOM node. */
export function controlIcon(ownerDocument: Document, part: ControlIconPart): SVGSVGElement {
  const namespace = "http://www.w3.org/2000/svg";
  const svg = ownerDocument.createElementNS(namespace, "svg");
  for (const [name, value] of Object.entries(CONTROL_ICON_ATTRIBUTES))
    svg.setAttribute(name, value);
  svg.dataset.fluidboxIcon = "";
  const path = ownerDocument.createElementNS(namespace, "path");
  path.setAttribute("d", CONTROL_ICON_PATHS[part]);
  svg.append(path);
  return svg;
}
