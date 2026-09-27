// His Underground / Her Underground artist photo pins. Invoked by
// src/his-pin-cron.js and src/her-pin-cron.js (the GitHub Actions entry
// points, gated to their Chicago hours) — running this file directly
// always runs immediately, same posture as the other pipelines.
import "dotenv/config";
import { config } from "../config.js";
import { claimedPosts } from "../ops/publishing.js";
import { getCandidates } from "./1-get-candidates.js";
import { findPhoto, loadDropPins } from "./2-find-photo.js";
import { postArtistPin, BOARDS } from "./3-post-pin.js";

// Bounds photo-search calls per run; the rest wait for the next slot.
const MAX_ARTISTS_TRIED = 8;

export async function runArtistPin(gender) {
  const posts = config.artistPinPublish ? await claimedPosts(BOARDS[gender].pipeline) : {};
  const used = new Set(Object.values(posts).map((post) => post.imageUrl).filter(Boolean));
  const candidates = await getCandidates(gender, posts);
  const dropPins = await loadDropPins();

  for (const candidate of candidates.slice(0, MAX_ARTISTS_TRIED)) {
    const photo = await findPhoto(candidate, used, dropPins);
    if (photo) return postArtistPin(gender, candidate, photo);
    console.log(`no usable photo for ${candidate.name}`);
  }
  return postArtistPin(gender, null, null);
}

export const runHisPin = () => runArtistPin("male");
export const runHerPin = () => runArtistPin("female");

const invokedDirectly = process.argv[1] && process.argv[1].endsWith("artist-pins/index.js");
if (invokedDirectly) {
  runArtistPin(process.argv[2] === "her" ? "female" : "male")
    .then((report) => {
      console.log(JSON.stringify(report, null, 2));
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
