import "@ogdakke/fluidbox/elements";
import { mountChrome } from "../design/chrome";
import "./pages.css";
import { mountInto } from "./mount";

mountChrome("angular");
mountInto("#gallery-root", () => import("../demos/angular").then((demo) => demo.mount));
mountInto("#indexed-root", () => import("../demos/angular").then((demo) => demo.mountIndexed));
