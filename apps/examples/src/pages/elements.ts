import "@ogdakke/fluidbox/elements";
import { mountChrome } from "../design/chrome";
import "./pages.css";
import { mountElements } from "../demos/elements";
import { mountIndexed } from "../demos/indexed";

mountChrome("elements");
mountElements(document.querySelector("#mosaic")!);
mountIndexed(document.querySelector("#virtual-gallery")!, document.querySelector("#jump-form")!);
