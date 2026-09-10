import { config } from "../config.js";

const BASE = "https://backend.composio.dev/api/v3/tools/execute";

export async function runTool(slug, args, account) {
  if (!config.composio.apiKey) {
    throw new Error("COMPOSIO_API_KEY missing");
  }
  const body = { arguments: args || {} };
  if (config.composio.userId) body.user_id = config.composio.userId;
  if (account) body.connected_account_id = account;

  const res = await fetch(`${BASE}/${slug}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": config.composio.apiKey,
    },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`${slug} ${res.status} ${JSON.stringify(json).slice(0, 400)}`);
  }
  return json.data || json;
}

export const accounts = config.composio.aliases;
