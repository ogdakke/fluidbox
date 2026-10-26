import { mountSite } from "../src/site";
import "@ogdakke/fluidbox/baseline.css";
import "@ogdakke/fluidbox/elements";
import "./media.css";
import "./hotspots.css";

mountSite("fixtures", {
  fixture: "Custom elements hotspots · <fluidbox-hotspot> pins in <fluidbox-media>",
});
