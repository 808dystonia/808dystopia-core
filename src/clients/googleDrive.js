import { runTool } from "./composio.js";
import { config } from "../config.js";

function pickUrl(obj, depth = 0) {
  if (!obj || depth > 5) return "";
  if (typeof obj === "string" && /^https?:\/\//.test(obj)) return obj;
  if (typeof obj !== "object") return "";
  for (const key of ["s3_url", "s3Url", "download_url", "downloadUrl", "webContentLink", "url", "file_url", "fileUrl"]) {
    if (typeof obj[key] === "string" && /^https?:\/\//.test(obj[key])) return obj[key];
  }
  for (const value of Object.values(obj)) {
    const found = pickUrl(value, depth + 1);
    if (found) return found;
  }
  return "";
}

function pickBytes(obj) {
  if (!obj || typeof obj !== "object") return null;
  const raw = obj.content || obj.file_content || obj.data || obj.bytes;
  if (typeof raw === "string" && raw.length > 1000) {
    try { return Buffer.from(raw, "base64"); } catch { return null; }
  }
  return null;
}

export async function downloadDriveFile(fileId) {
  const raw = await runTool("GOOGLEDRIVE_DOWNLOAD_FILE", { fileId }, config.composio.aliases.drive);
  const bytes = pickBytes(raw);
  if (bytes && bytes.length > 1000) return bytes;
  const url = pickUrl(raw);
  if (!url) throw new Error(`Drive download had no file for ${fileId}: ${JSON.stringify(raw).slice(0, 400)}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Drive file fetch ${res.status} ${url}`);
  return Buffer.from(await res.arrayBuffer());
}
