import { mountSite } from "../site";
import "./pages.css";
import { mountHeadless } from "../demos/headless";

mountSite("headless");
mountHeadless(document.querySelector("#headless-grid")!);
