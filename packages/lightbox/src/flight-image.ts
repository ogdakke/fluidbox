/** Keep the painted source visible until its closing-flight clone can replace it. */
export async function handoffDecodedFlightImage(
  source: HTMLElement,
  flight: HTMLImageElement,
  isCurrent: () => boolean,
) {
  await flight.decode().catch(() => {});
  if (!isCurrent()) return false;
  source.dataset.lightboxFlightSourceHidden = "";
  return true;
}
