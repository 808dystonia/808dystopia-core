// Posts a video directly to TikTok via the Content Posting API's
// FILE_UPLOAD flow -- chosen over PULL_FROM_URL specifically because that
// mode requires TikTok to have verified whatever domain hosts the video
// file, which would mean hosting reel clips on 808dystopia.win and
// getting that domain separately verified; uploading the bytes we
// already have locally (same file the IG Reel step already produced)
// needs no such verification.
import { readFile, stat } from "node:fs/promises";
import { getValidAccessToken } from "./tiktokAuth.js";

const CREATOR_INFO_URL = "https://open.tiktokapis.com/v2/post/publish/creator_info/query/";
const INIT_URL = "https://open.tiktokapis.com/v2/post/publish/video/init/";
const STATUS_URL = "https://open.tiktokapis.com/v2/post/publish/status/fetch/";

// TikTok's own chunking rules (content-posting-api-media-transfer-guide):
// under 5 MB must go as a single chunk; otherwise each chunk is 5-64 MB
// except the last, which absorbs the remainder (may run over chunk_size,
// up to 128 MB) -- reel clips are short highlight cuts, well under that
// ceiling in practice.
const MIN_WHOLE_FILE_BYTES = 5 * 1024 * 1024;
const CHUNK_SIZE = 10 * 1024 * 1024;

const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 2 * 60 * 1000;

// Confirmed live (first real cross-post attempt, 2026-09-16): hardcoding
// PUBLIC_TO_EVERYONE does NOT get silently downgraded for an unaudited
// app the way TikTok's own prose docs suggested -- it's a hard rejection,
// "unaudited_client_can_only_post_to_private_accounts". The Content
// Posting API has a dedicated endpoint for exactly this: query the
// creator's actual available privacy_level_options and use one of those,
// rather than assuming a fixed value ever works. Preferring
// PUBLIC_TO_EVERYONE when it's offered means this automatically starts
// posting publicly the moment the app passes TikTok's audit, with no code
// change needed here.
async function getCreatorInfo(accessToken) {
  const res = await fetch(CREATOR_INFO_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json; charset=UTF-8",
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error?.code !== "ok" || !data.data) {
    throw new Error(`TikTok creator_info query failed: ${JSON.stringify(data)}`);
  }
  return data.data;
}

function pickPrivacyLevel(options) {
  if (!options?.length) throw new Error("TikTok creator_info returned no privacy_level_options");
  return options.includes("PUBLIC_TO_EVERYONE") ? "PUBLIC_TO_EVERYONE" : options[0];
}

async function initUpload(accessToken, { filePath, caption, creatorInfo }) {
  const { size: videoSize } = await stat(filePath);
  const singleChunk = videoSize < MIN_WHOLE_FILE_BYTES;
  const chunkSize = singleChunk ? videoSize : CHUNK_SIZE;
  const totalChunkCount = singleChunk ? 1 : Math.floor(videoSize / chunkSize);

  const res = await fetch(INIT_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json; charset=UTF-8",
    },
    body: JSON.stringify({
      post_info: {
        title: caption,
        privacy_level: pickPrivacyLevel(creatorInfo.privacy_level_options),
        disable_duet: !!creatorInfo.duet_disabled,
        disable_comment: !!creatorInfo.comment_disabled,
        disable_stitch: !!creatorInfo.stitch_disabled,
      },
      source_info: {
        source: "FILE_UPLOAD",
        video_size: videoSize,
        chunk_size: chunkSize,
        total_chunk_count: totalChunkCount,
      },
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error?.code !== "ok" || !data.data?.upload_url) {
    throw new Error(`TikTok post init failed: ${JSON.stringify(data)}`);
  }
  return { videoSize, chunkSize, totalChunkCount, publishId: data.data.publish_id, uploadUrl: data.data.upload_url };
}

async function uploadChunks({ filePath, videoSize, chunkSize, totalChunkCount, uploadUrl }) {
  const fileBuffer = await readFile(filePath);

  // File chunks must be uploaded sequentially (TikTok's own requirement) --
  // an intentional for-of + await, not Promise.all.
  for (let i = 0; i < totalChunkCount; i++) {
    const start = i * chunkSize;
    const isLast = i === totalChunkCount - 1;
    const end = isLast ? videoSize - 1 : start + chunkSize - 1;
    const chunk = fileBuffer.subarray(start, end + 1);

    const res = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": "video/mp4",
        "Content-Length": String(chunk.length),
        "Content-Range": `bytes ${start}-${end}/${videoSize}`,
      },
      body: chunk,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`TikTok chunk ${i + 1}/${totalChunkCount} upload failed: ${res.status} ${text.slice(0, 300)}`);
    }
  }
}

async function waitForPublish(accessToken, publishId) {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const res = await fetch(STATUS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json; charset=UTF-8",
      },
      body: JSON.stringify({ publish_id: publishId }),
    });
    const data = await res.json().catch(() => ({}));
    const status = data.data?.status;

    if (status === "PUBLISH_COMPLETE" || status === "SEND_TO_USER_INBOX") return status;
    if (status === "FAILED") throw new Error(`TikTok publish failed: ${data.data?.fail_reason || "unknown reason"}`);

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
  throw new Error(`TikTok publish ${publishId} timed out waiting to process`);
}

export async function postVideoToTikTok({ filePath, caption }) {
  const accessToken = await getValidAccessToken();
  const creatorInfo = await getCreatorInfo(accessToken);
  const init = await initUpload(accessToken, { filePath, caption, creatorInfo });
  await uploadChunks({ filePath, ...init });
  const status = await waitForPublish(accessToken, init.publishId);
  return { publishId: init.publishId, status, privacyLevel: pickPrivacyLevel(creatorInfo.privacy_level_options) };
}
