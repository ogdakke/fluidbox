import "@ogdakke/fluidbox/elements";
import { mountSite } from "../site";
import "./pages.css";
import { mountInto } from "./mount";

mountSite("vue");
mountInto("#gallery-root", () => import("../demos/vue").then((demo) => demo.mount));
mountInto("#indexed-root", () => import("../demos/vue").then((demo) => demo.mountIndexed));
