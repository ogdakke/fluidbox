import "@ogdakke/fluidbox/elements";
import { mountSite } from "../site";
import "./pages.css";
import { mountControls, mountElements } from "../demos/elements";

mountSite("overview");
const gallery = document.querySelector<HTMLElement>("#mosaic")!;
mountElements(gallery);
mountControls(gallery, document.querySelector<HTMLFormElement>("#controls")!);
