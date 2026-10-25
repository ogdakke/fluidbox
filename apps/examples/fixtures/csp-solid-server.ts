import { renderToString } from "solid-js/web";
import { CspSolid } from "./csp-solid";

/** The Solid Root's server HTML, for csp.html?solid to hydrate. */
export const renderCspSolid = () => renderToString(CspSolid);
