// TikTok source for the Reel pipeline -- curated video links only, no
// automated per-artist search. Confirmed live: TikTok's user-profile/
// video-listing endpoint blocks yt-dlp's extraction even with browser
// impersonation (curl_cffi) installed -- the profile page itself loads
// fine, but the request for that account's video list comes back empty,
// which reads as TikTok's own anti-bot protection on that specific
// endpoint, not a sandbox/proxy issue. A single already-known video URL
// extracts and downloads cleanly with no special handling, so this only
// works from links someone (Grok or a human) pastes into #tv -- see
// clients/discord.js's parseTikTokUrls and reels/1-get-watchlist.js.
import { getVideoInfo } from "./ytdlp.js";

// Same floor as the Twitch fallback (clients/twitch.js) -- both are short
// clip-native platforms, unlike YouTube's search results.
const MIN_DURATION_SECONDS = 15;
const MAX_DURATION_SECONDS = 10 * 60;

export async function getTikTokClip(url) {
  const info = await getVideoInfo(url);
  if (!info.duration || info.duration < MIN_DURATION_SECONDS || info.duration > MAX_DURATION_SECONDS) return null;

  return {
    videoId: info.id,
    title: info.description || info.title || "TikTok clip",
    channelTitle: info.uploader || info.channel || null,
    publishedAt: info.upload_date
      ? `${info.upload_date.slice(0, 4)}-${info.upload_date.slice(4, 6)}-${info.upload_date.slice(6, 8)}`
      : null,
    url: info.webpage_url || url,
    durationSeconds: info.duration,
    artist: info.uploader || info.channel || "Unknown artist",
    contentType: "TikTok clip",
    source: "tiktok",
  };
}
