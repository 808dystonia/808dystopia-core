export async function imageSearch(query) {
  const cx = process.env.GOOGLE_CSE_ID;
  const key = process.env.GOOGLE_CSE_KEY;
  if (!cx || !key) return [];
  const url = new URL("https://www.googleapis.com/customsearch/v1");
  url.searchParams.set("q", query);
  url.searchParams.set("cx", cx);
  url.searchParams.set("key", key);
  url.searchParams.set("searchType", "image");
  url.searchParams.set("num", "6");
  url.searchParams.set("safe", "off");
  const res = await fetch(url);
  const json = await res.json();
  return (json.items || [])
    .map((it) => it.link)
    .filter((u) => /\.(jpg|jpeg|png|webp)(\?|$)/i.test(u) || u.startsWith("http"));
}
