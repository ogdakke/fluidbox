// One map view shared by the static preview (scripts/fetch-map.ts) and the live OpenStreetMap embed.
export const mapView = {
  title: "Helsinki Market Square on OpenStreetMap",
  lat: 60.1675,
  lon: 24.9525,
  zoom: 15,
  width: 1000,
  height: 700,
};

/** Bounding box of the preview at its zoom level, so the embed opens on the same area. */
export function mapEmbedUrl(): string {
  const { lat, lon, zoom, width, height } = mapView;
  const scale = 256 * 2 ** zoom;
  const toLon = (x: number) => (x / scale) * 360 - 180;
  const toLat = (y: number) =>
    (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / scale))) * 180) / Math.PI;
  const cx = ((lon + 180) / 360) * scale;
  const latRad = (lat * Math.PI) / 180;
  const cy = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * scale;
  const bbox = [
    toLon(cx - width / 2),
    toLat(cy + height / 2),
    toLon(cx + width / 2),
    toLat(cy - height / 2),
  ].map((value) => value.toFixed(5));
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox.join("%2C")}&layer=mapnik&marker=${lat}%2C${lon}`;
}
