import "@ogdakke/fluidbox/elements";
import { mountSite } from "../site";
import "./pages.css";
import { mountElements } from "../demos/elements";
import { mountIndexed } from "../demos/indexed";

mountSite("elements");
mountElements(document.querySelector("#mosaic")!);
mountIndexed(document.querySelector("#virtual-gallery")!, document.querySelector("#jump-form")!);
