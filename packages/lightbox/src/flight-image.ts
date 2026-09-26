/** Keep the painted source visible until its closing-flight clone can replace it. */
export async function handoffDecodedFlightImage(
  source: HTMLElement,
  flight: HTMLImageElement,
  isCurrent: () => boolean,
  ready: Promise<unknown> = flight.decode(),
) {
  await ready.catch(() => {});
  if (!isCurrent()) return false;
  source.dataset.lightboxFlightSourceHidden = "";
  return true;
}
