export const isDevMode = import.meta.env.DEV;

/**
 * Saves data to a JSON file via the dev-only REST API.
 * path examples: "trips", "kyushu-2024/itinerary", "kyushu-2024/shops"
 */
export async function saveData(apiPath: string, data: unknown): Promise<void> {
  if (!isDevMode) return;
  const res = await fetch(`/api/data/${apiPath}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(err.error ?? "Failed to save");
  }
}
