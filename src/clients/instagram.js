// Instagram publish (via Composio) — standard Graph API carousel flow:
// create a media container per slide, combine into a carousel container,
// then publish it. Video containers process asynchronously on Meta's side
// (status_code starts IN_PROGRESS); publishing before a container reaches
// FINISHED fails, so every container gets polled the same way regardless
// of type (images are usually already done by the time they're checked).
import { config } from "../config.js";
import { runTool, runProxy } from "./composio.js";

function accountId() {
  return config.instagram.connectedAccountId || undefined;
}

export async function createImageContainer(imageUrl) {
  const result = await runTool(
    "INSTAGRAM_CREATE_MEDIA_CONTAINER",
    { ig_user_id: config.instagram.userId, image_url: imageUrl, is_carousel_item: true },
    accountId()
  );
  return result.id;
}

// A standalone single-image post, not a carousel item -- no
// is_carousel_item, and the caption goes directly on this container
// (same reasoning as createReelContainer below, just for a still image).
export async function createStandaloneImageContainer(imageUrl, caption) {
  const result = await runTool(
    "INSTAGRAM_CREATE_MEDIA_CONTAINER",
    { ig_user_id: config.instagram.userId, image_url: imageUrl, caption },
    accountId()
  );
  return result.id;
}

// Composio's wrapper requires an explicit media_type override for video —
// without it, the underlying Graph API call omits video_url entirely and
// fails asking for image_url instead.
export async function createVideoContainer(videoUrl) {
  const result = await runTool(
    "INSTAGRAM_CREATE_MEDIA_CONTAINER",
    { ig_user_id: config.instagram.userId, video_url: videoUrl, is_carousel_item: true, media_type: "VIDEO" },
    accountId()
  );
  return result.id;
}

// A standalone Reel, not a carousel item — no is_carousel_item, and the
// caption goes directly on this container rather than the (nonexistent,
// for a single-item post) carousel container. media_type: "REELS" is
// Meta's own Graph API value for this (POST /{ig-user-id}/media docs),
// analogous to the VIDEO override above for carousel video items.
// NOT YET LIVE-VALIDATED: this session's local COMPOSIO_API_KEY is stale
// (401 against Composio's API, same issue seen earlier reading Discord/
// Sheets locally — a local-only mismatch, not a production issue, since
// the real GitHub Actions secret has worked for every carousel post so
// far) so the exact param shape couldn't be confirmed against a live
// call the way every other step in this pipeline was. Confirm this on
// the first real test run before fully trusting it.
export async function createReelContainer(videoUrl, caption) {
  const result = await runTool(
    "INSTAGRAM_CREATE_MEDIA_CONTAINER",
    { ig_user_id: config.instagram.userId, video_url: videoUrl, media_type: "REELS", caption },
    accountId()
  );
  return result.id;
}

const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 120000;

export async function waitForContainerReady(creationId) {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const result = await runTool("INSTAGRAM_GET_POST_STATUS", { creation_id: creationId }, accountId());
    if (result.status_code === "FINISHED") return;
    if (result.status_code === "ERROR" || result.status_code === "EXPIRED") {
      throw new Error(`container ${creationId} failed to process: ${result.status_code}`);
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
  throw new Error(`container ${creationId} timed out waiting to process`);
}

// Collab invites: Composio's container tools have no `collaborators`
// field, so a post with a collaborator creates its final container
// through the raw Graph API proxy instead (POST /{ig-user-id}/media,
// same connected account as postComment). The artist gets an invite when
// the post publishes; if they accept, it also shows on their profile.
// Genius handles are self-reported, so anything that isn't a plain IG
// username is ignored rather than guessed at.
const IG_USERNAME = /^[a-z0-9._]{1,30}$/i;
const OWN_USERNAME = "808dystopia";

export function collaboratorHandle(handle) {
  const clean = String(handle || "").trim().replace(/^@/, "");
  if (!IG_USERNAME.test(clean) || clean.toLowerCase() === OWN_USERNAME) return null;
  return clean;
}

async function createContainerViaProxy(params) {
  const result = await runProxy({
    connectedAccountId: accountId(),
    endpoint: `/${config.instagram.userId}/media`,
    method: "POST",
    body: params,
  });
  if (!result?.id) throw new Error(`container create returned no id: ${JSON.stringify(result).slice(0, 300)}`);
  return result.id;
}

export function createCollabReelContainer(videoUrl, caption, collaborators) {
  return createContainerViaProxy({ media_type: "REELS", video_url: videoUrl, caption, collaborators });
}

export function createCollabCarouselContainer({ children, caption, collaborators }) {
  return createContainerViaProxy({ media_type: "CAROUSEL", children, caption, collaborators });
}

// Creates the final container with the collaborator when there is one,
// and falls back to the plain container on any failure (private account,
// stale handle, proxy error). Nothing is published at this stage, so
// creating a second container is safe; an unused one expires on its own.
export async function createReadyContainer({ label, collaborator, withCollaborator, plain }) {
  const handle = collaboratorHandle(collaborator);
  if (handle) {
    try {
      const id = await withCollaborator([handle]);
      await waitForContainerReady(id);
      return { containerId: id, collaborator: handle };
    } catch (err) {
      console.log(`${label}: collab container with @${handle} failed, posting without it:`, err.message);
    }
  }
  const id = await plain();
  await waitForContainerReady(id);
  return { containerId: id, collaborator: null };
}

export async function createCarouselContainer({ children, caption }) {
  const result = await runTool(
    "INSTAGRAM_CREATE_CAROUSEL_CONTAINER",
    { ig_user_id: config.instagram.userId, children, caption },
    accountId()
  );
  return result.id;
}

export async function publishContainer(creationId) {
  const result = await runTool(
    "INSTAGRAM_CREATE_POST",
    { ig_user_id: config.instagram.userId, creation_id: creationId },
    accountId()
  );
  return result.id;
}

// Account-level insights for the EOD brief -- validated live (real reach
// data returned for @808dystopia) via this session's interactive Composio
// MCP connection, NOT yet confirmed against this project's own runTool
// path (its stored API key is stale in this sandbox, same limitation as
// several other clients here) -- so the exact unwrapping below matches
// the established pattern from e.g. googleSheets.js's readLogRows
// (runTool's return value is the tool result object directly, e.g.
// {valueRanges: [...]} or here {data: [...]}, matching Meta's own Graph
// API shape) rather than the extra diagnostic wrapper the interactive
// MCP meta-tool added on top for my own benefit. Confirm on first real
// run. Instagram silently OMITS a metric from the response instead of
// erroring when there's no data for the period, or (specifically for
// follower_count/online_followers) when the account is under 100
// followers -- this returns a plain {metricName: value} map with omitted
// metrics simply absent, so the caller can tell "no data" from an actual
// zero rather than guessing/zero-filling.
const DAILY_METRICS = [
  "reach",
  "accounts_engaged",
  "total_interactions",
  "likes",
  "comments",
  "shares",
  "saves",
  "profile_views",
  "follower_count",
];

export async function getDailyInsights(sinceDate, untilDate) {
  const result = await runTool(
    "INSTAGRAM_GET_USER_INSIGHTS",
    { ig_user_id: config.instagram.userId, metric: DAILY_METRICS, period: "day", since: sinceDate, until: untilDate },
    accountId()
  );
  const metrics = {};
  for (const entry of result?.data || []) {
    const latest = entry.values?.[entry.values.length - 1];
    metrics[entry.name] = latest?.value ?? null;
  }
  return metrics;
}

// Composio's instagram toolkit only wraps "reply to an existing comment",
// not "create a top-level comment on a media post" (POST /{media-id}/comments
// with no comment_id) — the raw proxy call hits that Graph API endpoint
// directly through the same connected account's token.
export async function postComment(mediaId, message) {
  return runProxy({
    connectedAccountId: accountId(),
    endpoint: `/${mediaId}/comments`,
    method: "POST",
    body: { message },
  });
}
