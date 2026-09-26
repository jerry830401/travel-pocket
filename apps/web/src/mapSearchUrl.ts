/** A Google Maps search for `query`; the app keeps no map links of its own. */
export function mapSearchUrl(query: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
