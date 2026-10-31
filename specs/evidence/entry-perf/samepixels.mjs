// samepixels.mjs <a> <b> ...pairs: decode both (sharp, no colour management) to raw RGBA and compare every byte.
import { createRequire } from "node:module";
const sharp = createRequire("/Users/DavidLiu/Developer/uwotsi/.claude/worktrees/entry-perf/web/")("sharp");
const args = process.argv.slice(2); let bad = 0;
for (let i = 0; i < args.length; i += 2) {
  const [a, b] = await Promise.all(args.slice(i, i + 2).map(f => sharp(f).ensureAlpha().raw().toBuffer({ resolveWithObject: true })));
  const same = a.info.width === b.info.width && a.info.height === b.info.height && a.data.equals(b.data);
  let diff = 0; if (!same && a.data.length === b.data.length) for (let k = 0; k < a.data.length; k++) diff += a.data[k] !== b.data[k];
  if (!same) bad++;
  console.log(`${same ? "identical" : `DIFFERENT (${diff} bytes)`} ${a.info.width}x${a.info.height} ${args[i].split("/").pop()} vs ${args[i + 1].split("/").pop()}`);
}
process.exit(bad ? 1 : 0);
