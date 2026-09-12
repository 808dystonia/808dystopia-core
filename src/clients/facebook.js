// Facebook, via Composio's raw Graph API proxy passthrough -- NOT the
// wrapped FACEBOOK_CREATE_PHOTO_POST/FACEBOOK_CREATE_POST tools. Confirmed
// live those wrapped tools fail with a genuine Facebook permission error
// ("This app is not allowed to publish to other users' timelines", then
// "publish_actions ... deprecated") even with the correct account and full
// admin rights on the Page -- Meta requires a Page-scoped access token for
// posting-as-Page, not the connected account's own user token, and the
// wrapped tools appear to use the latter. The real fix, confirmed live:
// exchange the user token for the Page's own token via /me/accounts, then
// post directly to the Page with that.
import { config } from "../config.js";
import { runProxy } from "./composio.js";

async function getPageAccessToken() {
  const res = await runProxy({
    connectedAccountId: config.facebook.connectedAccountId || undefined,
    endpoint: "/me/accounts?fields=id,access_token",
    method: "GET",
  });
  const page = (res?.data || []).find((p) => p.id === config.facebook.pageId);
  if (!page) throw new Error(`No managed Page found matching FACEBOOK_PAGE_ID ${config.facebook.pageId}`);
  return page.access_token;
}

// Posts multiple images as one swipeable multi-photo Page post (matches
// the IG carousel's multiple slides, instead of only ever cross-posting
// the cover). Confirmed live: a single photos-endpoint call only makes a
// single-image post -- an actual multi-photo post needs each image
// uploaded unpublished first (published: false, no post created yet),
// then one /feed call referencing all of them via attached_media.
export async function createMultiPhotoPost({ imageUrls, message }) {
  const pageAccessToken = await getPageAccessToken();

  const photoIds = [];
  for (const url of imageUrls) {
    const res = await runProxy({
      connectedAccountId: config.facebook.connectedAccountId || undefined,
      endpoint: `/${config.facebook.pageId}/photos`,
      method: "POST",
      body: { url, published: false, access_token: pageAccessToken },
    });
    photoIds.push(res.id);
  }

  const attachedMedia = JSON.stringify(photoIds.map((id) => ({ media_fbid: id })));
  return runProxy({
    connectedAccountId: config.facebook.connectedAccountId || undefined,
    endpoint: `/${config.facebook.pageId}/feed`,
    method: "POST",
    body: { message, attached_media: attachedMedia, access_token: pageAccessToken },
  });
}

// Posts a video with a caption from a public video URL -- same
// fetch-it-yourself shape as photos, but the Graph API's video endpoint
// takes file_url/description instead of url/message.
export async function createVideoPost({ videoUrl, message }) {
  const pageAccessToken = await getPageAccessToken();
  return runProxy({
    connectedAccountId: config.facebook.connectedAccountId || undefined,
    endpoint: `/${config.facebook.pageId}/videos`,
    method: "POST",
    body: { file_url: videoUrl, description: message, access_token: pageAccessToken },
  });
}
