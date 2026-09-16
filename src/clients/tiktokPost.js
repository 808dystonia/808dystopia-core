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
// total_chunk_count = floor(video_size / chunk_size); non-final chunks
// must be 5-64 MB; the final chunk absorbs the remainder and may run up
// to 128 MB. Confirmed live (2026-09-16): that floor division is exactly
// right for a real multi-chunk upload, but it breaks for anything between
// 5 MB and CHUNK_SIZE -- floor(8MB / 10MB) = 0, an invalid chunk count
// TikTok rejected as "chunk size is invalid". Reel clips (~50s highlight
// cuts) land in that range often enough to hit this on a real post, not
// just a theoretical edge. Since nothing in TikTok's docs requires a
// single chunk to be under 5 MB -- only that a single chunk IS the final
// chunk, capped at 128 MB -- anything up to that cap goes as one whole
// chunk; only a video that would actually need >1 chunk uses CHUNK_SIZE.
const SINGLE_CHUNK_MAX_BYTES = 128 * 1024 * 1024;
const CHUNK_SIZE = 10 * 1024 * 1024;

const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 2 * 60 * 1000;

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

async function initUpload(accessToken, { filePath, caption, privacyLevel, creatorInfo }) {
  const { size: videoSize } = await stat(filePath);
  const singleChunk = videoSize <= SINGLE_CHUNK_MAX_BYTES;
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
        privacy_level: privacyLevel,
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
    const err = new Error(`TikTok post init failed: ${JSON.stringify(data)}`);
    err.code = data.error?.code;
    throw err;
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

const UNAUDITED_ERROR_CODE = "unaudited_client_can_only_post_to_private_accounts";

export async function postVideoToTikTok({ filePath, caption }) {
  const accessToken = await getValidAccessToken();
  const creatorInfo = await getCreatorInfo(accessToken);
  let privacyLevel = pickPrivacyLevel(creatorInfo.privacy_level_options);

  let init;
  try {
    init = await initUpload(accessToken, { filePath, caption, privacyLevel, creatorInfo });
  } catch (err) {
    // Confirmed live (2026-09-16): creator_info's privacy_level_options
    // reflects the ACCOUNT's public/private setting, not whether this
    // APP has passed TikTok's own audit -- a public account still lists
    // PUBLIC_TO_EVERYONE as available even while the app is unaudited,
    // and the post endpoint enforces a separate, stricter app-level gate
    // that creator_info never exposes at all. Retrying with the one
    // level TikTok's own error names as safe for an unaudited app, rather
    // than trusting creator_info's answer a second time. This still
    // self-heals once the app passes audit: creator_info's own choice
    // will simply stop failing, so this fallback path just never fires.
    if (err.code !== UNAUDITED_ERROR_CODE) throw err;
    privacyLevel = "SELF_ONLY";
    init = await initUpload(accessToken, { filePath, caption, privacyLevel, creatorInfo });
  }

  await uploadChunks({ filePath, ...init });
  const status = await waitForPublish(accessToken, init.publishId);
  return { publishId: init.publishId, status, privacyLevel };
}
