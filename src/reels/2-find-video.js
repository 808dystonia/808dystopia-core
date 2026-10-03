// Step 2: for a watchlist artist/producer, find one usable video — a
// performance, beat/preset breakdown, interview, or livestream clip. The
// watchlist only names who, not what, so this tries several content-type
// query variants per artist, in priority order, and returns the first
// candidate that passes the vetting checks below.
//
// Transcript/caption availability is NOT checked here (see clients/youtube.js
// for why third-party transcript access is dead) — step 3+ transcribes the
// downloaded video locally with Whisper instead, so any video qualifies.
// What IS checked, via videos.list status/contentDetails:
//   - not a live/upcoming broadcast (liveBroadcastContent === "none") —
//     this pipeline wants a finished clip, not an ongoing stream
//   - public, embeddable, fully processed (skips flagged/restricted/
//     removed/still-processing videos — these generally don't come back
//     as healthy status fields, which covers the spec's "skip anything
//     flagged/DMCA'd")
//   - a duration long enough to contain a real highlight and short enough
//     to keep local Whisper transcription (step 3) fast
//
// If YouTube turns up nothing usable, falls back to the artist's own
// Twitch clips (clients/twitch.js) as a secondary source — Twitch has no
// platform-wide clip search, only a channel-name lookup, so this only
// works when the artist has an active Twitch channel under a matching
// name. A Twitch clip is already short (well under our highlight-window
// limits), so it's returned in the exact same shape as a YouTube result
// (videoId/title/artist/contentType/durationSeconds/url) and needs no
// changes to steps 3-7 — a clip just becomes another `video` object,
// downloaded by its `url` like any other.
//
// Per-artist only: dedup against previously-used videos (never repost a
// clip) happens in reels/index.js against the Sheet log, same as the news
// pipeline's isAlreadyPosted — if this artist's pick turns out already
// logged, index.js falls back to the next watchlist artist rather than
// asking this function for a second video.
import { searchVideos, searchChannels, getChannelUploads, getVideoDetails } from "../clients/youtube.js";
import { findChannelId, getClips } from "../clients/twitch.js";
import { mentionsArtist } from "../artist-pins/2-find-photo.js";
import { describeError } from "../util/describeError.js";

// The artist name is quoted so YouTube treats it as a phrase rather than
// loose keywords ("SouthWes interview" used to return job-interview tips).
// Queries for content the artist is in come first; "beat breakdown" last,
// since its results are mostly other producers' tutorials on the artist's
// sound (classified and captioned as such below).
const CONTENT_TYPE_QUERIES = [
  (artist) => ({ label: "interview", query: `"${artist}" interview` }),
  (artist) => ({ label: "performance", query: `"${artist}" live performance` }),
  (artist) => ({ label: "freestyle", query: `"${artist}" freestyle` }),
  (artist) => ({ label: "studio session", query: `"${artist}" studio session` }),
  (artist) => ({ label: "beat breakdown", query: `"${artist}" beat breakdown` }),
];

// Search matched strangers for ambiguous names ("OK" became a college
// football player, "Rok" an unrelated band, "Caneva" a Canva talk), so a
// result is only used when it plainly belongs to the artist and is music.
// Names shorter than this are too ambiguous to search for at all.
const MIN_NAME_LENGTH = 4;
const compact = (value) => String(value || "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
const MUSIC_CATEGORY_ID = "10";
const MUSIC_WORDS =
  /\b(rap|rapper|rapping|hip ?hop|freestyle|cypher|beats?|producer|prod|studio session|verse|bars|mixtape|album|single|song|track|music|music video|official (video|audio)|lyrics?|visualizer|remix|feat|ft|concert|tour|plugg|drill|trap|rage|underground|vevo)\b/i;

// Videos that name the artist but are someone else talking about them:
// a producer's type-beat tutorial, a reaction, a review. They're allowed,
// but the caption must say what they are, the quote is the creator's (not
// the artist's), and the artist gets no collab invite. 10/03: "How To Make
// GYGJFACB Type Beats For BLEOOD!" went out captioned as bleood.
const ABOUT_TYPES = [
  [/\b(type ?beats?|how to (make|produce|sound|flow|rap)|tutorial|drum ?kits?|sample ?packs?|loop ?kits?|presets?|free for profit|remake|in the style of)\b/i, "type beat tutorial"],
  [/\b(reacts?|reaction|reacting)\b/i, "reaction"],
  [/\b(review|reviews|reviewing|breakdown of)\b/i, "review"],
];

// relation: "by" (the artist's own upload), "featuring" (a third-party
// video the artist is in: interview, live set, freestyle), or "about"
// (someone else discussing the artist).
export function classifyVideo(title, fallbackLabel, ownChannel = false) {
  const about = ABOUT_TYPES.find(([pattern]) => pattern.test(title || ""));
  if (about) return { contentType: about[1], relation: ownChannel ? "by" : "about" };
  return { contentType: ownChannel ? labelFromTitle(title) : labelFromTitle(title, fallbackLabel), relation: ownChannel ? "by" : "featuring" };
}

export function isSearchableName(artist) {
  return compact(artist).length >= MIN_NAME_LENGTH;
}

// The title or channel has to name the artist (a channel like
// "SouthWesMusic" counts), and the title, tags, channel or YouTube's own
// Music category has to say it's music.
export function isArtistMusicVideo(details, artist) {
  if (!isSearchableName(artist)) return false;
  const target = compact(artist);
  const namesArtist =
    mentionsArtist(artist, details.title, MIN_NAME_LENGTH) ||
    mentionsArtist(artist, details.channelTitle, MIN_NAME_LENGTH) ||
    compact(details.channelTitle).startsWith(target);
  if (!namesArtist) return false;
  const text = [details.title, details.channelTitle, ...(details.tags || [])].join(" ");
  return details.categoryId === MUSIC_CATEGORY_ID || MUSIC_WORDS.test(text);
}

// The artist's own channel: named exactly like them, optionally with a
// common suffix ("bleoodMusic", "bleood VEVO", "Official bleood").
// YouTube's auto-generated "Artist - Topic" channels are static-image audio
// uploads, useless for a Reel.
const CHANNEL_AFFIXES = /^(official)?$|^(music|official|vevo|tv|hq|beats)$/;

export function isOwnChannel(channelTitle, artist) {
  if (!isSearchableName(artist) || /-\s*topic$/i.test(channelTitle || "")) return false;
  const channel = compact(channelTitle);
  const target = compact(artist);
  if (channel === `official${target}`) return true;
  return channel.startsWith(target) && CHANNEL_AFFIXES.test(channel.slice(target.length));
}

function labelFromTitle(title, fallback = "music video") {
  if (/\bfreestyle\b/i.test(title)) return "freestyle";
  if (/\b(interview|podcast)\b/i.test(title)) return "interview";
  if (/\b(live|performance|concert|set)\b/i.test(title)) return "performance";
  if (/\bstudio\b/i.test(title)) return "studio session";
  return fallback;
}

// First choice: something the artist posted themselves.
async function findOwnChannelVideo(artist, isUsed) {
  const channels = await searchChannels(`"${artist}"`);
  const own = channels.find((channel) => isOwnChannel(channel.title, artist));
  if (!own) return null;

  const ids = await getChannelUploads(own.channelId);
  if (ids.length === 0) return null;
  const details = await getVideoDetails(ids);
  const usable = details.find((d) => isUsable(d) && !isUsed(d.videoId));
  return usable ? { ...usable, artist, ...classifyVideo(usable.title, null, true) } : null;
}

const MIN_DURATION_SECONDS = 45;
// Kept modest (not the 45 min originally planned) because step 3 transcribes
// the entire video locally with CPU-only Whisper inside a time-boxed GitHub
// Actions job -- a much longer video risks blowing the job timeout just to
// pick one highlight.
const MAX_DURATION_SECONDS = 20 * 60;

function isUsable(details) {
  return (
    details.liveBroadcastContent === "none" &&
    details.uploadStatus === "processed" &&
    details.privacyStatus === "public" &&
    details.embeddable &&
    details.durationSeconds >= MIN_DURATION_SECONDS &&
    details.durationSeconds <= MAX_DURATION_SECONDS
  );
}

// Twitch clips are inherently short (well under YouTube's 45s floor above
// -- most are 15-60s), so this uses a lower minimum matching step 3's own
// MIN_CLIP_SECONDS: anything shorter can't satisfy a valid highlight
// window anyway, regardless of source.
const TWITCH_MIN_DURATION_SECONDS = 15;

async function findTwitchClip(artistHandle) {
  const channelId = await findChannelId(artistHandle);
  if (!channelId) return null;

  const clips = await getClips(channelId, 20);
  const usable = clips.find((clip) => clip.duration >= TWITCH_MIN_DURATION_SECONDS);
  if (!usable) return null;

  return {
    videoId: usable.id,
    title: usable.title,
    channelTitle: usable.broadcaster_name,
    publishedAt: usable.created_at,
    url: usable.url,
    durationSeconds: usable.duration,
    artist: artistHandle,
    contentType: "livestream clip",
    relation: "by",
    source: "twitch",
  };
}

export async function findVideo(artistHandle, isUsed = () => false) {
  if (!isSearchableName(artistHandle)) {
    console.log(`findVideo: skipping "${artistHandle}", name too short to search unambiguously`);
    return null;
  }

  try {
    const own = await findOwnChannelVideo(artistHandle, isUsed);
    if (own) return own;
  } catch (err) {
    console.log(`own-channel lookup for ${artistHandle} failed:`, describeError(err));
  }

  // A video the artist is in wins over one about them, even from a later
  // query; the first "about" video is kept as the fallback.
  let aboutFallback = null;
  for (const buildQuery of CONTENT_TYPE_QUERIES) {
    const { label, query } = buildQuery(artistHandle);
    const results = await searchVideos(query, { maxResults: 5 });
    if (results.length === 0) continue;

    const details = await getVideoDetails(results.map((r) => r.videoId));
    for (const d of details) {
      if (!isUsable(d) || isUsed(d.videoId) || !isArtistMusicVideo(d, artistHandle)) continue;
      const video = { ...d, artist: artistHandle, ...classifyVideo(d.title, label) };
      if (video.relation !== "about") return video;
      aboutFallback ||= video;
    }
  }
  if (aboutFallback) return aboutFallback;

  try {
    const twitchClip = await findTwitchClip(artistHandle);
    if (twitchClip) return twitchClip;
  } catch (err) {
    console.log(`twitch fallback for ${artistHandle} failed:`, describeError(err));
  }
  return null;
}
