// ImgBB — free image host. Instagram's Graph API needs a public URL to
// fetch each slide from (it doesn't accept direct file uploads), and the
// rendered slides only exist as local PNGs on disk — this is the bridge.
// Called directly (not via Composio): a single trivial upload endpoint
// doesn't need the connected-account/OAuth layer the other integrations use.
import fs from "node:fs";
import { config } from "../config.js";

const API = "https://api.imgbb.com/1/upload";

export async function uploadImage(filePath) {
  if (!config.imgbb.apiKey) throw new Error("IMGBB_API_KEY missing");

  const base64 = fs.readFileSync(filePath).toString("base64");
  const body = new URLSearchParams({ key: config.imgbb.apiKey, image: base64 });

  const res = await fetch(API, { method: "POST", body });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.success) {
    throw new Error(`imgbb upload ${res.status} ${JSON.stringify(json).slice(0, 300)}`);
  }
  return json.data.url;
}
