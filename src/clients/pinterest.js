// Pinterest search, via Composio. PINTEREST_SEARCH_OWN_CONTENT only searches
// the connected account's own pins/boards — Pinterest's API has no
// general public-catalog search. So this only finds anything once
// reference photos are actually pinned to the connected account.
import { config } from "../config.js";
import { runTool } from "./composio.js";

// Image URL extraction is based on Pinterest's documented pin media shape
// (media.images keyed by size) — not yet confirmed against a live pin since
// the connected account has none pinned yet.
function extractImageUrl(pin) {
  const images = pin?.media?.images || {};
  for (const size of ["1200x", "600x", "400x300", "150x150"]) {
    if (images[size]?.url) return images[size].url;
  }
  return null;
}

export async function searchOwnPins(query) {
  const res = await runTool(
    "PINTEREST_SEARCH_OWN_CONTENT",
    { query, resource_type: "pins" },
    config.pinterest.connectedAccountId || undefined
  );
  const items = res?.items || [];
  for (const pin of items) {
    const url = extractImageUrl(pin);
    if (url) return url;
  }
  return null;
}
