// Google Images results via Composio's built-in image search (no
// separate connected account). Google's own Programmable Search dropped
// whole-web search for new engines (March 2026) -- see
// pipeline/3-get-photo.js -- so this goes through Composio instead.
// Returns metadata only; callers decide whether a result is trustworthy.
import { runTool } from "./composio.js";

export async function searchImages(query, num = 30) {
  const res = await runTool("COMPOSIO_SEARCH_IMAGE", { query, num });
  const items = res?.results?.images_results || res?.images_results || [];
  return items.map((r) => ({
    imageUrl: r.original || null,
    width: Number(r.original_width) || null,
    height: Number(r.original_height) || null,
    title: r.title || "",
    pageUrl: r.link || r.source_link || null,
  }));
}
