import { mountSite, type PageKey } from "../site";
import "../pages/pages.css";
import { exampleRegions } from "./regions";
import { patternNames, type PatternName } from "./shared";

export { exampleRegions };

/** Mount one pattern into its root; the result, if any, unmounts it. */
export type MountPattern = (root: HTMLElement) => void | (() => void);
export type Framework = "elements" | "javascript" | "react" | "solid" | "vue" | "angular";

export const frameworks: Record<Framework, { label: string; entry: string }> = {
  elements: { label: "Custom elements", entry: "@ogdakke/fluidbox/elements" },
  javascript: { label: "JavaScript", entry: "@ogdakke/fluidbox" },
  react: { label: "React", entry: "@ogdakke/fluidbox/react" },
  solid: { label: "Solid", entry: "@ogdakke/fluidbox/solid" },
  vue: { label: "Vue", entry: "@ogdakke/fluidbox/vue" },
  angular: { label: "Angular", entry: "@ogdakke/fluidbox/angular" },
};

export const patternInfo: Record<PatternName, { title: string; note: string }> = {
  basic: { title: "Gallery", note: "A trigger per photo, with the default controls." },
  overlay: {
    title: "One trigger for an album",
    note: "Every photo returns to the cover, which shows the last one viewed. The count travels with the flight.",
  },
  origins: {
    title: "Rich origins",
    note: "A photo inside a card, and a scroller that brings the photo you close on back into view.",
  },
  renderers: {
    title: "Custom content",
    note: "A component that reads app context, a live map and a video.",
  },
  programmatic: {
    title: "Programmatic control",
    note: "Open from code, read the state, log events, and veto navigation.",
  },
  zoom: {
    title: "Zoom",
    note: "Zoom controls, a zoom readout, and a sharper image as the zoom grows. Or zoom off.",
  },
  thumbnails: { title: "Thumbnails", note: "The default strip, and one with your own thumbnails." },
  sheet: {
    title: "Sheet",
    note: "A panel under the photo with snap points, stop buttons and a text field.",
  },
  headless: { title: "Headless controls", note: "Your own caption bar and buttons." },
  rtl: {
    title: "Right to left",
    note: "A gallery in an Arabic, right-to-left section: the viewer reads its direction and language from there.",
  },
  url: {
    title: "Photo in the address",
    note: "The open photo lives in ?photo=, so a link opens it and Back closes it.",
  },
  hover: {
    title: "Hover zoom",
    note: "A product photo that magnifies under a resting mouse, and opens the viewer on a click.",
  },
  media: {
    title: "Product media",
    note: "A photo, a YouTube video that loads on Play, a 360° spin and a 3D model in one gallery. The model is Damaged Helmet from the Khronos glTF Sample Assets: © 2016 theblueturtle_, CC BY-NC 4.0; glTF rebuild © 2018 ctxwing, CC BY 4.0. Non-commercial use only.",
  },
};

/** Build the page: one section per pattern, its live example, and the code that made it. */
export function mountPatternPage(
  framework: Framework,
  patterns: Record<PatternName, MountPattern>,
  sources: Record<string, string>,
): void {
  mountSite(framework as PageKey);
  const main = document.querySelector<HTMLElement>("#patterns")!;
  patternNames.forEach((name, index) => {
    const info = patternInfo[name];
    const section = document.createElement("section");
    section.className = "section";
    section.id = name;
    const number = String(index + 1).padStart(2, "0");
    section.innerHTML = `
      <header class="section__head">
        <p class="fb-label"><span class="fb-number">${number}</span>&nbsp;&nbsp;${name}</p>
        <h2 class="fb-rule-title"></h2>
        <p></p>
      </header>
      <div class="stage"><div class="pattern" data-pattern="${name}"></div></div>`;
    section.querySelector("h2")!.textContent = info.title;
    section.querySelector(".section__head p:last-child")!.textContent = info.note;
    const files = Object.entries(sources).filter(([path]) =>
      new RegExp(`/${name}\\.[a-z]+$`, "i").test(path),
    );
    for (const [path, source] of files) {
      const details = document.createElement("details");
      details.className = "fb-code";
      const summary = document.createElement("summary");
      summary.textContent = path.split("/").pop()!;
      details.append(summary);
      // Highlighted at build time from the file's example regions.
      details.insertAdjacentHTML("beforeend", source);
      section.append(details);
    }
    main.append(section);
    const root = section.querySelector<HTMLElement>("[data-pattern]")!;
    try {
      patterns[name](root);
    } catch (error) {
      console.error(error);
      root.textContent = `Failed to mount: ${String(error)}`;
    }
  });
  document.documentElement.dataset.patternsReady = "";
}
