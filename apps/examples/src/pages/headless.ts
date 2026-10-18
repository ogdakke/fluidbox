import { mountChrome } from "../design/chrome";
import "./pages.css";
import { mountHeadless } from "../demos/headless";

mountChrome("headless");
mountHeadless(document.querySelector("#headless-grid")!);
