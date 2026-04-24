/**
 * Shared OAuth2 client for Drive + Sheets.
 *
 * Uses a refresh token granted once by davidliu8473@gmail.com (see
 * scripts/oauth-setup.mjs). Files created by this client are owned
 * by that user and count against the user's Drive quota — unlike the
 * service account path, which has no personal storage quota.
 */

import { google } from "googleapis";
import type { OAuth2Client } from "google-auth-library";

let cached: OAuth2Client | null = null;

export function getOAuthClient(): OAuth2Client {
  if (cached) return cached;

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      "Google OAuth env vars missing (GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, GOOGLE_OAUTH_REFRESH_TOKEN). Run scripts/oauth-setup.mjs."
    );
  }

  const client = new google.auth.OAuth2(clientId, clientSecret);
  client.setCredentials({ refresh_token: refreshToken });
  cached = client;
  return client;
}
