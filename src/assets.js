import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "./config.js";
import { downloadDriveFile } from "./clients/googleDrive.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const assetsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "templates/assets");
const tmpDir = path.join(root, "tmp");

export const brandAssets = {
  dir: assetsDir,
  font: path.join(assetsDir, "Capture_it.ttf"),
  jingle: path.join(assetsDir, "808-Dystopia_Jingle.mp3"),
  closer: path.join(tmpDir, "808-Dystopia_Outro.mp4"),
  closerMasterDriveId: config.outroDriveId,
  closerIgDriveId: config.outroIgDriveId,
  jingleDriveId: config.jingleDriveId,
};

export function assetStatus() {
  return {
    font: fs.existsSync(brandAssets.font),
    jingle: fs.existsSync(brandAssets.jingle),
    closer: fs.existsSync(brandAssets.closer),
  };
}

export async function ensureCloser() {
  fs.mkdirSync(tmpDir, { recursive: true });
  if (fs.existsSync(brandAssets.closer) && fs.statSync(brandAssets.closer).size > 500000) {
    return brandAssets.closer;
  }
  const ids = [config.outroIgDriveId, config.outroDriveId].filter(Boolean);
  let lastErr = null;
  for (const id of ids) {
    try {
      const buf = await downloadDriveFile(id);
      if (!buf || buf.length < 500000) throw new Error(`too small (${buf?.length || 0})`);
      fs.writeFileSync(brandAssets.closer, buf);
      console.log("closer from Drive", id, buf.length);
      return brandAssets.closer;
    } catch (err) {
      lastErr = err;
      console.log("Drive closer miss", id, err.message);
    }
  }
  throw lastErr || new Error("no closer Drive id");
}
