import "@ogdakke/fluidbox/elements";
import { mountSite } from "../site";
import "./pages.css";
import { mountInto } from "./mount";

mountSite("angular");
mountInto("#gallery-root", () => import("../demos/angular").then((demo) => demo.mount));
mountInto("#indexed-root", () => import("../demos/angular").then((demo) => demo.mountIndexed));
