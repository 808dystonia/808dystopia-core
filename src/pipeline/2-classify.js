// Step 2: classify a candidate story via Gemini into album_drop / diss /
// other, plus extracted fields. Expected return shape:
//   { type: "album_drop" | "diss" | "other", artist: string, title: string,
//     tracklist?: string[], hook?: string }
// artist/title are required even for "other" — the dedup check in
// index.js needs them to compare against the Sheet log.
// TODO: implement once GEMINI_API_KEY is available.

export async function classifyArticle(_candidate) {
  throw new Error("not implemented: classifyArticle");
}
