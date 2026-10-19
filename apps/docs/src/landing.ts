import "@ogdakke/fluidbox/elements";
import { mountChrome } from "@ogdakke/fluidbox-design/chrome";
import "../../examples/src/pages/pages.css";
import "./docs.css";
import { mountDemos } from "./demos";
import { siteLinks } from "./site";
import { mountTabs } from "./tabs";

mountChrome({ ...siteLinks, active: "home" });
mountDemos(document.body);
mountTabs(document.body);
