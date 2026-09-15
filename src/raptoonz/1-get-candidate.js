// Step 1: pick one rapper/producer + cartoon-art-style pair to generate.
// Rappers come from the same #tv watchlist the Reel and album-art Pin
// pipelines already read (clients/discord.js's parseWatchlist +
// parseTvBoard) -- reusing it rather than maintaining a third list.
import { listReelsChannelMessages, parseWatchlist, parseTvBoard } from "../clients/discord.js";
import { readRaptoonzLogRows, isRaptoonzAlreadyPosted } from "../clients/googleSheets.js";

// Well-known shows with a distinctive, easily-recognizable visual style --
// a short description cue for each since the image model won't reliably
// infer a show's exact look from its title alone.
export const CARTOON_STYLES = [
  { name: "Johnny Bravo", description: "late-1990s Cartoon Network style: bold thick black outlines, exaggerated square jaw, flat bright colors, simple blocky character design" },
  { name: "Dexter's Laboratory", description: "geometric angular character design, high-contrast primary colors, retro-futuristic lab aesthetic" },
  { name: "The Powerpuff Girls", description: "simple round heads with big eyes, minimalist flat-color bodies, bold black outlines, candy-bright palette" },
  { name: "Courage the Cowardly Dog", description: "surreal proportions, muted eerie color palette, soft rounded shapes with an unsettling edge" },
  { name: "Ed, Edd n Eddy", description: "exaggerated lumpy proportions, scratchy hand-drawn outlines, warm suburban color palette" },
  { name: "Chowder", description: "bulbous rounded shapes, saturated candy-colored palette, thick wobbly outlines" },
  { name: "Adventure Time", description: "noodle-limbed characters, simple dot eyes, flat pastel color palette, minimalist backgrounds" },
  { name: "Regular Show", description: "clean simple character shapes, muted naturalistic color palette, understated line art" },
  { name: "Total Drama Island", description: "exaggerated facial expressions, thick confident outlines, bright saturated cartoon-reality-show palette" },
  { name: "Samurai Jack", description: "stylized minimalist shapes, dramatic negative space, painterly muted backgrounds, bold silhouettes" },
  { name: "The Amazing World of Gumball", description: "mixed-media collage style, bright flat colors, simple rounded character shapes" },
  { name: "Steven Universe", description: "soft rounded shapes, pastel gem-toned color palette, gentle clean line art" },
  { name: "We Bare Bears", description: "soft minimalist shapes, muted natural color palette, clean simple line art" },
  { name: "Codename: Kids Next Door", description: "chunky simplified shapes, bold primary colors, thick confident outlines" },
];

function shuffle(items) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// Tries rapper x style pairs in random order until one hasn't been posted
// before. Returns null -- never a fabricated pick -- if every pair is
// already covered, or the watchlist itself is empty.
export async function getCandidate() {
  const messages = await listReelsChannelMessages();
  const watchlist = parseWatchlist(messages);
  const tvNames = parseTvBoard(messages);
  const merged = new Map();
  for (const name of watchlist) merged.set(name.toLowerCase(), name);
  for (const name of tvNames) if (!merged.has(name.toLowerCase())) merged.set(name.toLowerCase(), name);
  const rappers = [...merged.values()];
  if (rappers.length === 0) return null;

  const logRows = await readRaptoonzLogRows();

  const pairs = shuffle(rappers.flatMap((rapper) => CARTOON_STYLES.map((style) => ({ rapper, style }))));
  for (const pair of pairs) {
    if (!isRaptoonzAlreadyPosted(logRows, { rapper: pair.rapper, style: pair.style.name })) return pair;
  }
  return null;
}
