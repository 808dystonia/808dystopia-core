import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "./config.js";

const assetsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "templates/assets");

export const brandAssets = {
  dir: assetsDir,
  font: path.join(assetsDir, "Capture_it.ttf"),
  jingle: path.join(assetsDir, "808-Dystopia_Jingle.mp3"),
  closer: path.join(assetsDir, "808-Dystopia_Outro.mp4"),
  closerMasterDriveId: "1RXsoQs4N8OnBfNSnMM0ZykADdwA-n3Us",
  closerIgDriveId: "1qDshAf0oa4eOjzZbZznYblokbe48rhKE",
  jingleDriveId: "1RR3uUJrdTYXwYnpT5sQ1trXEx6CBefae",
};

export function assetStatus() {
  return {
    font: fs.existsSync(brandAssets.font),
    jingle: fs.existsSync(brandAssets.jingle),
    closer: fs.existsSync(brandAssets.closer),
  };
}

export function requireJingle() {
  if (!fs.existsSync(brandAssets.jingle)) {
    throw new Error(`jingle missing at ${brandAssets.jingle}`);
  }
  return brandAssets.jingle;
}

export function closerPathOrNull() {
  return fs.existsSync(brandAssets.closer) ? brandAssets.closer : null;
}

export { config };
