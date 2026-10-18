import "@ogdakke/fluidbox/elements";
import { mountSite } from "../site";
import "./pages.css";
import { mountElements } from "../demos/elements";

mountSite("overview");
mountElements(document.querySelector("#mosaic")!);
