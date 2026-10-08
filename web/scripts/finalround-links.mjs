// Generate signed /finalround links from a CSV of accepted members.
//
// Usage: node scripts/finalround-links.mjs accepted.csv [baseUrl] > links.csv
// CSV columns: name,project (header row optional). Output: name,project,link
// Token format must match app/finalround/token.ts.

import { createHmac } from "crypto";
import { readFileSync } from "fs";

const env = readFileSync(".env.local", "utf8")
  .split("\n")
  .reduce((acc, line) => {
    const m = line.match(/^([^=]+)=(.*)$/);
    if (m) acc[m[1].trim()] = m[2].trim();
    return acc;
  }, {});

const secret = process.env.FINALROUND_SECRET || env.FINALROUND_SECRET;
const [csvPath, base = "https://tethos.ca"] = process.argv.slice(2);
if (!secret || !csvPath) {
  console.error("Need FINALROUND_SECRET and a CSV path.");
  process.exit(1);
}

function parseRow(line) {
  const cells = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ",") {
      cells.push(cur);
      cur = "";
    } else cur += c;
  }
  cells.push(cur);
  return cells.map((s) => s.trim());
}

const esc = (s) => (/[",]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);

const rows = readFileSync(csvPath, "utf8").split(/\r?\n/).filter((l) => l.trim());
if (/^name\b/i.test(rows[0])) rows.shift();

console.log("name,project,link");
for (const line of rows) {
  const [name, project = ""] = parseRow(line);
  if (!name) continue;
  const payload = Buffer.from(JSON.stringify({ n: name, p: project })).toString("base64url");
  const sig = createHmac("sha256", secret).update(payload).digest().subarray(0, 18).toString("base64url");
  console.log([esc(name), esc(project), `${base}/finalround/${payload}.${sig}`].join(","));
}
