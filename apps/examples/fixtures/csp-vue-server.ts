import { createSSRApp } from "vue";
import { renderToString } from "vue/server-renderer";
import { CspVue } from "./csp-vue";

/** The Vue Root's server HTML, for csp.html?vue to hydrate. */
export const renderCspVue = () => renderToString(createSSRApp(CspVue));
