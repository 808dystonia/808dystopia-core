import fs from "node:fs";
import { config } from "../config.js";
import { runTool } from "../clients/composio.js";
import { ensureCloser } from "../assets.js";

const UGUU = "https://uguu.se/upload";

async function hostFile(filePath, mime) {
  const buf = fs.readFileSync(filePath);
  const form = new FormData();
  form.append("files[]", new Blob([buf], { type: mime }), filePath.split("/").pop());
  const res = await fetch(UGUU, { method: "POST", body: form });
  const json = await res.json();
  const url = json.files?.[0]?.url || json.url;
  if (!url) throw new Error(`host fail ${JSON.stringify(json).slice(0, 200)}`);
  return url;
}

export async function hostImage(filePath) {
  return hostFile(filePath, "image/jpeg");
}

export async function hostCloser() {
  const closer = await ensureCloser();
  return hostFile(closer, "video/mp4");
}

export async function publishCarousel({ urls, caption, comments, closerUrl }) {
  if (!config.publish) return { published: false, mediaId: "", urls, closerUrl: closerUrl || "" };
  const children = [];
  for (const url of urls) {
    const created = await runTool("INSTAGRAM_POST_IG_USER_MEDIA", { ig_user_id: config.igUserId, image_url: url, is_carousel_item: true }, "808 Instagram");
    const id = created.id || created.data?.id;
    if (!id) throw new Error(`no child id ${JSON.stringify(created).slice(0, 200)}`);
    children.push(id);
  }
  if (closerUrl) {
    const video = await runTool("INSTAGRAM_POST_IG_USER_MEDIA", {
      ig_user_id: config.igUserId,
      media_type: "VIDEO",
      video_url: closerUrl,
      is_carousel_item: true,
    }, "808 Instagram");
    const vid = video.id || video.data?.id;
    if (!vid) throw new Error(`no closer id ${JSON.stringify(video).slice(0, 200)}`);
    children.push(vid);
  }
  const parent = await runTool("INSTAGRAM_POST_IG_USER_MEDIA", { ig_user_id: config.igUserId, media_type: "CAROUSEL", children, caption }, "808 Instagram");
  const creation = parent.id || parent.data?.id;
  const published = await runTool("INSTAGRAM_POST_IG_USER_MEDIA_PUBLISH", { ig_user_id: config.igUserId, creation_id: creation, max_wait_seconds: 180 }, "808 Instagram");
  const mediaId = published.id || published.data?.id || "";
  if (mediaId) {
    for (const batch of comments) {
      try { await runTool("INSTAGRAM_POST_IG_MEDIA_COMMENTS", { ig_media_id: mediaId, message: batch }, "808 Instagram"); }
      catch (err) { console.log("comment:", err.message); }
    }
  }
  return { published: true, mediaId, urls, closerUrl: closerUrl || "" };
}
