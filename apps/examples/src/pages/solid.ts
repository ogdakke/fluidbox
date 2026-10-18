import "@ogdakke/fluidbox/elements";
import { mountChrome } from "../design/chrome";
import "./pages.css";
import { mountInto } from "./mount";

mountChrome("solid");
mountInto("#gallery-root", () => import("../demos/solid").then((demo) => demo.mount));
mountInto("#indexed-root", () => import("../demos/solid").then((demo) => demo.mountIndexed));
