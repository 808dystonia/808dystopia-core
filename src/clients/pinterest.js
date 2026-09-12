// Pinterest, via Composio. PINTEREST_SEARCH_OWN_CONTENT only searches
// the connected account's own pins/boards — Pinterest's API has no
// general public-catalog search. So this only finds anything once
// reference photos are actually pinned to the connected account.
import { config } from "../config.js";
import { runTool } from "./composio.js";

// Image URL extraction is based on Pinterest's documented pin media shape
// (media.images keyed by size) — confirmed live against a real pin.
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

// Creates an image Pin from a public image URL (Pinterest fetches it
// itself — no upload/base64 needed). Confirmed live: this Pinterest
// connection has full Standard write access, not the Trial-tier sandbox
// restriction PINTEREST_CREATE_PIN's own docs warn about.
export async function createPin({ boardId, title, description, imageUrl, link }) {
  return runTool(
    "PINTEREST_CREATE_PIN",
    {
      board_id: boardId,
      media_source: { source_type: "image_url", url: imageUrl },
      ...(title ? { title } : {}),
      ...(description ? { description } : {}),
      ...(link ? { link } : {}),
    },
    config.pinterest.connectedAccountId || undefined
  );
}
