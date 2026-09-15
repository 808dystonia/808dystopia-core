// Redirect target for 808 Dystopia's TikTok Developer app's OAuth flow
// (registered in TikTok's portal as the app's redirect URI -- this exact
// path, https://808dystopia.win/api/tiktok-oauth-callback). Built as a
// custom flow after Composio's own custom-auth token exchange for TikTok
// failed live (its server-side call to TikTok's token endpoint didn't
// come back with an access_token, for reasons on Composio's side we
// couldn't diagnose further) -- see clients/tiktokAuth.js for the rest of
// this integration.
//
// Runs inside Netlify's own runtime, so it gets auto-provisioned Blobs
// config for free (no siteID/token needed here -- only external readers/
// writers, like the GitHub Actions job that later refreshes these tokens,
// need those explicitly; see clients/netlifyBlobs.js).
import { getStore } from "@netlify/blobs";

const TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token/";
const REDIRECT_URI = "https://808dystopia.win/api/tiktok-oauth-callback";

export default async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  if (error) {
    return new Response(`TikTok login failed: ${error} -- ${url.searchParams.get("error_description") || ""}`, {
      status: 400,
    });
  }
  if (!code) {
    return new Response("Missing ?code from TikTok's redirect.", { status: 400 });
  }

  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET;
  if (!clientKey || !clientSecret) {
    return new Response("Server misconfigured: TIKTOK_CLIENT_KEY/TIKTOK_CLIENT_SECRET not set on the Netlify site.", {
      status: 500,
    });
  }

  // TikTok's own OAuth quirk (confirmed against its docs): the form field
  // is "client_key", not the standard OAuth "client_id" -- and the body
  // must be form-urlencoded, not JSON.
  const body = new URLSearchParams({
    client_key: clientKey,
    client_secret: clientSecret,
    code,
    grant_type: "authorization_code",
    redirect_uri: REDIRECT_URI,
  });

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = await res.json().catch(() => ({}));

  if (!res.ok || !data.access_token) {
    return new Response(`Token exchange failed: ${JSON.stringify(data)}`, { status: 502 });
  }

  const store = getStore("tiktok-auth");
  await store.setJSON("tokens", {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    openId: data.open_id,
    scope: data.scope,
    // expires_in/refresh_expires_in are seconds-from-now at issuance --
    // stored as absolute timestamps so a later reader doesn't need to
    // know when this ran.
    accessTokenExpiresAt: new Date(Date.now() + data.expires_in * 1000).toISOString(),
    refreshTokenExpiresAt: new Date(Date.now() + data.refresh_expires_in * 1000).toISOString(),
    obtainedAt: new Date().toISOString(),
  });

  return new Response("808 Dystopia's TikTok account is connected. You can close this tab.", {
    headers: { "content-type": "text/plain" },
  });
};

export const config = {
  path: "/api/tiktok-oauth-callback",
};
