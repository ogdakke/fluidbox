import "@ogdakke/fluidbox/elements";
import { mountChrome } from "@ogdakke/fluidbox-design/chrome";
import "../../examples/src/pages/pages.css";
import "./docs.css";
import { mountControls, mountElements } from "../../examples/src/demos/elements";
import { mountPackageManagers } from "./package-managers";
import { siteLinks } from "./site";

mountChrome({ ...siteLinks, active: "home" });
mountPackageManagers(document);
// The playground the example site opens with.
const gallery = document.querySelector<HTMLElement>("#mosaic")!;
mountElements(gallery);
mountControls(gallery, document.querySelector<HTMLFormElement>("#controls")!);
