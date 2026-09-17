#!/usr/bin/env node
// One-time OAuth consent flow that gets a refresh token for Google
// Drive + Sheets, then appends it to .env.local as GOOGLE_OAUTH_REFRESH_TOKEN.
//
// Run: node scripts/oauth-setup.mjs
// Use --token-file /private/path/token to save outside .env.local instead.
// Open http://localhost:8787/start to begin consent without copying OAuth URLs.
// 1. Script prints a URL and waits on a local callback port.
// 2. You open the URL in any browser (must be signed in as davidliu8473@gmail.com).
// 3. Approve the Drive + Sheets scopes.
// 4. Browser redirects to http://localhost:8787/ — script captures the code.
// 5. Script exchanges code → refresh_token, writes it to .env.local.

import { google } from "googleapis";
import http from "node:http";
import { randomBytes, timingSafeEqual } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { URL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
if (args.length && (args.length !== 2 || args[0] !== "--token-file" || !path.isAbsolute(args[1]))) {
  console.error("Usage: node scripts/oauth-setup.mjs [--token-file /absolute/private/path]");
  process.exit(1);
}
const tokenFile = args[1];
const state = randomBytes(32).toString("hex");
const ENV_PATH = path.join(__dirname, "..", ".env.local");

function loadEnv() {
  if (!fs.existsSync(ENV_PATH)) return;
  const text = fs.readFileSync(ENV_PATH, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
  }
}
loadEnv();

const CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error("Missing GOOGLE_OAUTH_CLIENT_ID or GOOGLE_OAUTH_CLIENT_SECRET in .env.local");
  process.exit(1);
}

const PORT = 8787;
const REDIRECT_URI = `http://localhost:${PORT}/`;
const SCOPES = [
  "https://www.googleapis.com/auth/drive",
  "https://www.googleapis.com/auth/spreadsheets",
];

const oauth2 = new google.auth.OAuth2({ clientId: CLIENT_ID, clientSecret: CLIENT_SECRET, redirectUri: REDIRECT_URI,
  transporterOptions: { timeout: 15000, retry: false },
});

const authUrl = oauth2.generateAuthUrl({
  access_type: "offline",
  state,
  login_hint: "davidliu8473@gmail.com",
  prompt: "consent", // force refresh_token even on repeat consents
  scope: SCOPES,
});

console.log("\n━━━ OAuth consent flow ━━━\n");
console.log("Open this URL in a browser signed in as davidliu8473@gmail.com:\n");
console.log(`${REDIRECT_URI}start`);
console.log("\nWaiting for redirect on", REDIRECT_URI, "...\n");

function appendEnv(key, value) {
  const existing = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, "utf8") : "";
  const re = new RegExp(`^${key}=.*$`, "m");
  let next;
  if (re.test(existing)) {
    next = existing.replace(re, `${key}=${value}`);
  } else {
    next = existing.replace(/\s*$/, `\n${key}=${value}\n`);
  }
  fs.writeFileSync(ENV_PATH, next);
}

const server = http.createServer(async (req, res) => {
  try {
    const u = new URL(req.url, REDIRECT_URI);
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Referrer-Policy", "no-referrer");
    if (req.method !== "GET") { res.writeHead(405); res.end("Method not allowed"); return; }
    if (u.pathname === "/start") { res.writeHead(302, { location: authUrl }); res.end(); return; }
    const suppliedState = Buffer.from(u.searchParams.get("state") ?? "");
    const expectedState = Buffer.from(state);
    if (suppliedState.length !== expectedState.length || !timingSafeEqual(suppliedState, expectedState)) {
      res.writeHead(400); res.end("Invalid consent session. Begin again at /start."); return;
    }
    const code = u.searchParams.get("code");
    const err = u.searchParams.get("error");

    if (err) {
      res.writeHead(400, { "content-type": "text/plain" });
      res.end("Google consent was not completed.");
      console.error("Google consent was not completed.");
      process.exit(1);
    }
    if (!code) {
      res.writeHead(404, { "content-type": "text/plain" });
      res.end("No code");
      return;
    }

    const { tokens } = await oauth2.getToken(code);
    if (!tokens.refresh_token) {
      res.writeHead(400, { "content-type": "text/plain" });
      res.end("No refresh_token returned. Revoke the grant and try again with prompt=consent.");
      console.error("FAILED: Google did not return a refresh token. No credentials were logged.");
      process.exit(1);
    }

    if (tokenFile) fs.writeFileSync(tokenFile, tokens.refresh_token, { mode: 0o600, flag: "wx" });
    else appendEnv("GOOGLE_OAUTH_REFRESH_TOKEN", tokens.refresh_token);

    res.writeHead(200, { "content-type": "text/html" });
    res.end(`
      <html>
        <body style="font-family: system-ui; max-width: 480px; margin: 80px auto; padding: 24px; background: #0F0F10; color: #F1FFFF;">
          <h2 style="color: #22c55e;">✓ Tethos Drive access granted</h2>
          <p>You can close this tab. ${tokenFile ? "Credential saved securely for connection verification. Your environment files are unchanged." : "Refresh token saved to <code>.env.local</code>."}</p>
        </body>
      </html>
    `);

    console.log(tokenFile ? "✓ Refresh token saved to the protected token file; .env.local unchanged." : "✓ Refresh token received and saved to .env.local");
    console.log("  access_token expires:", tokens.expiry_date && new Date(tokens.expiry_date).toISOString());

    setTimeout(() => {
      server.close();
      process.exit(0);
    }, 500);
  } catch {
    console.error("OAuth exchange or credential save failed. No credentials were logged.");
    res.writeHead(500, { "content-type": "text/plain" });
    res.end("Could not finish reconnecting. Return to Codex to retry.");
    process.exit(1);
  }
});

server.on("error", () => { console.error("Could not start local OAuth callback server."); process.exit(1); });
server.listen(PORT, "127.0.0.1", () => {
  // ready
});

setTimeout(() => {
  console.error("\nTimed out after 5 minutes. Re-run the script if you missed the consent window.");
  server.close();
  process.exit(1);
}, 5 * 60 * 1000);
