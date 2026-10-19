import { mountPatternPage } from "../page";
import { patterns } from "./index";

const sources = import.meta.glob<string>("./*.{ts,tsx,vue,html}", {
  query: "?highlighted",
  import: "default",
  eager: true,
});
mountPatternPage("angular", patterns, sources);
