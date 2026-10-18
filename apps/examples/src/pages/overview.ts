import "@ogdakke/fluidbox/elements";
import { mountChrome } from "../design/chrome";
import "./pages.css";
import { mountElements } from "../demos/elements";

mountChrome("overview");
mountElements(document.querySelector("#mosaic")!);
