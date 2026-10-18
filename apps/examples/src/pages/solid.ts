import "@ogdakke/fluidbox/elements";
import { mountSite } from "../site";
import "./pages.css";
import { mountInto } from "./mount";

mountSite("solid");
mountInto("#gallery-root", () => import("../demos/solid").then((demo) => demo.mount));
mountInto("#indexed-root", () => import("../demos/solid").then((demo) => demo.mountIndexed));
