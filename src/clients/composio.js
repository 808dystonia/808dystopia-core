// Wrapper around Composio's tool-execution API (https://docs.composio.dev).
// Used for: Discord read, Pinterest search, Instagram publish, Google Sheets read/append.
import { config } from "../config.js";

const BASE = "https://backend.composio.dev/api/v3/tools/execute";

export async function runTool(slug, args = {}, connectedAccountId) {
  if (!config.composio.apiKey) throw new Error("COMPOSIO_API_KEY missing");

  const body = { arguments: args };
  if (config.composio.userId) body.user_id = config.composio.userId;
  if (connectedAccountId) body.connected_account_id = connectedAccountId;

  const res = await fetch(`${BASE}/${slug}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": config.composio.apiKey,
    },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.successful === false) {
    const detail = json.error?.message || json.error || JSON.stringify(json).slice(0, 300);
    throw new Error(`${slug} failed: ${res.status} ${detail}`);
  }
  return json.data ?? json;
}

// Raw passthrough to a connected account's underlying API, authenticated
// with its stored token — for endpoints that don't have a wrapped Composio
// tool. Used for posting Instagram's first comment: Composio's instagram
// toolkit only has "reply to an existing comment", not "create a top-level
// comment on a media post" (POST /{media-id}/comments with no comment_id).
export async function runProxy({ connectedAccountId, endpoint, method = "GET", body }) {
  if (!config.composio.apiKey) throw new Error("COMPOSIO_API_KEY missing");

  const res = await fetch(`https://backend.composio.dev/api/v3/tools/execute/proxy`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": config.composio.apiKey,
    },
    body: JSON.stringify({ connected_account_id: connectedAccountId, endpoint, method, body }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.successful === false) {
    const detail = json.error?.message || json.error || JSON.stringify(json).slice(0, 300);
    throw new Error(`proxy ${method} ${endpoint} failed: ${res.status} ${detail}`);
  }
  return json.data ?? json;
}
