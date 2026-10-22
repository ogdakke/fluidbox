/**
 * The sandbox an iframe item gets when it names none. Embeds such as YouTube,
 * Vimeo and maps keep working, and the page they frame can't navigate the top
 * window, open modals or download. Fullscreen comes from `allow`.
 */
export const IFRAME_SANDBOX_DEFAULT =
  "allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-presentation";
