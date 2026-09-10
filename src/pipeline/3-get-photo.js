// Step 3: real photo of the artist/producer. Pinterest (via Composio) first,
// Google Custom Search image fallback second. Never AI-generated. If both
// fail, the article is treated as failed and step 1 retries the next one.
// TODO: implement once Pinterest (Composio) and Google CSE are wired up.

export async function getPhoto(_item) {
  throw new Error("not implemented: getPhoto");
}
