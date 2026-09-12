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

// Posts an image with a caption from a public image URL (Facebook fetches
// it itself -- no upload needed).
export async function createPhotoPost({ imageUrl, message }) {
  const pageAccessToken = await getPageAccessToken();
  return runProxy({
    connectedAccountId: config.facebook.connectedAccountId || undefined,
    endpoint: `/${config.facebook.pageId}/photos`,
    method: "POST",
    body: { url: imageUrl, message, access_token: pageAccessToken },
  });
}
