import "@ogdakke/fluidbox/elements";
import { mountChrome } from "../design/chrome";
import "./pages.css";
import { mountInto } from "./mount";

mountChrome("vue");
mountInto("#gallery-root", () => import("../demos/vue").then((demo) => demo.mount));
mountInto("#indexed-root", () => import("../demos/vue").then((demo) => demo.mountIndexed));
