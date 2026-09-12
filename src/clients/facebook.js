// Facebook, via Composio. Only supports Facebook Pages, not personal
// profiles -- config.facebook.pageId is the "808 Dystopia" Page, found
// via FACEBOOK_LIST_MANAGED_PAGES (distinct from the connected account's
// own user id, which just identifies the person managing the Page).
import { config } from "../config.js";
import { runTool } from "./composio.js";

// Posts an image with a caption from a public image URL (Facebook
// fetches it itself -- no upload needed, same shape as Pinterest's
// image_url pin source). Confirmed live against the real Page.
export async function createPhotoPost({ imageUrl, message }) {
  return runTool(
    "FACEBOOK_CREATE_PHOTO_POST",
    { page_id: config.facebook.pageId, url: imageUrl, message },
    config.facebook.connectedAccountId || undefined
  );
}
