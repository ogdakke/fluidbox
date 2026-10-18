/** Register the browser custom elements after hydration or on a client-only page. */
export async function registerFluidboxElements(): Promise<void> {
  if (typeof customElements === "undefined") return;
  await import("./elements");
}
