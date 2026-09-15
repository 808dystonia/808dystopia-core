// Reads/refreshes the TikTok OAuth tokens that
// site/netlify/functions/tiktok-oauth-callback.mjs stored when the login
// flow completed. Access tokens are short-lived (~24h per TikTok's docs),
// so every real run needs this to refresh first -- refreshing also
// rotates the refresh_token itself, which must be persisted back or the
// next refresh fails.
import { config } from "../config.js";
import { readTikTokTokens, writeTikTokTokens } from "./netlifyBlobs.js";

const TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token/";

// Refresh a bit before actual expiry -- avoids a race where the token is
// still "valid" by a few seconds when this check runs but expires before
// the upload finishes.
const REFRESH_MARGIN_MS = 5 * 60 * 1000;

async function refresh(tokens) {
  if (!config.tiktok.clientKey || !config.tiktok.clientSecret) {
    throw new Error("TIKTOK_CLIENT_KEY/TIKTOK_CLIENT_SECRET missing");
  }

  const body = new URLSearchParams({
    client_key: config.tiktok.clientKey,
    client_secret: config.tiktok.clientSecret,
    grant_type: "refresh_token",
    refresh_token: tokens.refreshToken,
  });

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) {
    throw new Error(`TikTok token refresh failed: ${JSON.stringify(data)}`);
  }

  const refreshed = {
    accessToken: data.access_token,
    // TikTok may rotate the refresh token on every use -- always persist
    // whatever it hands back, never assume the old one still works.
    refreshToken: data.refresh_token || tokens.refreshToken,
    openId: data.open_id || tokens.openId,
    scope: data.scope || tokens.scope,
    accessTokenExpiresAt: new Date(Date.now() + data.expires_in * 1000).toISOString(),
    refreshTokenExpiresAt: new Date(Date.now() + data.refresh_expires_in * 1000).toISOString(),
    obtainedAt: new Date().toISOString(),
  };
  await writeTikTokTokens(refreshed);
  return refreshed;
}

// Returns a definitely-valid access token, refreshing first if the stored
// one is at or past its refresh margin. Throws with a clear message if no
// connection exists yet (login flow never completed) or the refresh
// token itself has expired (needs a fresh login).
export async function getValidAccessToken() {
  const tokens = await readTikTokTokens();
  if (!tokens?.refreshToken) {
    throw new Error("No TikTok connection on file -- complete the login flow first.");
  }

  const refreshTokenExpiresAt = new Date(tokens.refreshTokenExpiresAt).getTime();
  if (Date.now() > refreshTokenExpiresAt) {
    throw new Error("TikTok refresh token has expired -- needs a fresh login.");
  }

  const accessTokenExpiresAt = new Date(tokens.accessTokenExpiresAt).getTime();
  if (Date.now() < accessTokenExpiresAt - REFRESH_MARGIN_MS) {
    return tokens.accessToken;
  }

  const refreshed = await refresh(tokens);
  return refreshed.accessToken;
}
