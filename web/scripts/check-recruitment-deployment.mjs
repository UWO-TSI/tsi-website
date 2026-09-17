#!/usr/bin/env node
// Read-only checks against the environment loaded by this checkout.
// No applicant data, secret values, migrations or Google writes are emitted.
import nextEnv from '@next/env';
import { google } from 'googleapis';
import { createClient } from '@supabase/supabase-js';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
nextEnv.loadEnvConfig(root, false, { info() {}, error() {} });
const names = ['GOOGLE_OAUTH_CLIENT_ID', 'GOOGLE_OAUTH_CLIENT_SECRET', 'GOOGLE_OAUTH_REFRESH_TOKEN',
  'GOOGLE_DRIVE_FOLDER_ID', 'GOOGLE_SHEETS_SPREADSHEET_ID', 'CRON_SECRET', 'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
const report = { checkedAt: new Date().toISOString(), scope: 'checkout configuration; external services are read-only',
  configuration: Object.fromEntries(names.map(name => [name, Boolean(process.env[name])])), google: { ready: false }, database: {}, roles: [], configurationReady: false,
  remainingVerification: ['Google write/readback', 'scheduled retries', 'Vercel production configuration'] };
const readyGoogle = names.slice(0, 3).every(name => process.env[name]);
if (readyGoogle) {
  const auth = new google.auth.OAuth2({ clientId: process.env.GOOGLE_OAUTH_CLIENT_ID, clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    transporterOptions: { timeout: 10000, retry: false } });
  auth.setCredentials({ refresh_token: process.env.GOOGLE_OAUTH_REFRESH_TOKEN });
  try {
    await auth.getAccessToken();
    const destination = process.env.GOOGLE_SHEETS_SPREADSHEET_ID || process.env.GOOGLE_DRIVE_FOLDER_ID;
    if (destination) {
      const file = await google.drive({ version: 'v3', auth }).files.get({ fileId: destination, supportsAllDrives: true,
        fields: 'capabilities(canEdit,canAddChildren)' }, { timeout: 10000, retry: false });
      const writable = process.env.GOOGLE_SHEETS_SPREADSHEET_ID ? file.data.capabilities?.canEdit : file.data.capabilities?.canAddChildren;
      report.google = { ready: Boolean(writable), authorization: 'valid', destinationWritable: Boolean(writable) };
    } else report.google = { ready: true, authorization: 'valid', destination: 'new workbook' };
  } catch (error) {
    report.google = { ready: false, authorization: error?.response?.data?.error === 'invalid_grant' ? 'reconnect_required' : 'unavailable' };
  }
} else report.google = { ready: false, authorization: 'credentials_missing' };
if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false },
    global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(15000) }) } });
  report.database.host = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname;
  for (const table of ['recruitment_sheet_state', 'recruitment_sheet_rows']) {
    const result = await db.from(table).select(table === 'recruitment_sheet_state' ? 'id' : 'sheet_row').limit(1);
    report.database[table] = { available: !result.error, code: result.error?.code ?? null };
  }
  const drafts = JSON.parse(await readFile(new URL('../lib/recruitment-round-drafts.json', import.meta.url), 'utf8'));
  const result = await db.from('positions').select('slug,is_active,visibility,opens_at,closes_at,archived_at').in('slug', drafts.map(role => role.slug));
  report.roles = drafts.map(role => {
    const live = result.data?.find(position => position.slug === role.slug);
    return { slug: role.slug, exists: Boolean(live), active: live?.is_active ?? false,
      opens_at: live?.opens_at ?? null, closes_at: live?.closes_at ?? null,
      ready: Boolean(live?.is_active && live.visibility === 'public' && !live.archived_at && live.opens_at && live.closes_at) };
  });
  report.database.rolesReadable = !result.error;
}
report.configurationReady = report.google.ready && Boolean(process.env.CRON_SECRET) &&
  report.database.recruitment_sheet_state?.available === true && report.database.recruitment_sheet_rows?.available === true &&
  report.roles.length > 0 && report.roles.every(role => role.ready);
console.log(JSON.stringify(report, null, 2));
process.exitCode = report.configurationReady ? 0 : 1;
