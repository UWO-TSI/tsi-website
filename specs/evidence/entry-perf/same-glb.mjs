// same-glb.mjs <before-root> <after-root> <list>: each GLB in the list (paths like /assets/x.glb) loaded from both roots
// by three's GLTFLoader (with its meshopt decoder) in headless Chromium, and compared as the game gets it: every node's
// transform, every geometry attribute and index array, every material property and texture setting, every texture's
// texels as WebGL receives them, every animation track; then four renders of each (three's renderer, 256 px) read back
// and compared byte for byte. Prints one line per file that differs, and a summary.
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { extname, join } from "node:path";

const [beforeRoot, afterRoot, listFile] = process.argv.slice(2);
const three = "/Users/DavidLiu/Developer/uwotsi/.claude/worktrees/entry-perf/web/node_modules/three";
const { chromium } = createRequire("/opt/homebrew/lib/node_modules/")("playwright");
const list = readFileSync(listFile, "utf8").split("\n").filter(Boolean);

const PAGE = `<!doctype html><script type="importmap">{"imports":{"three":"/three/build/three.module.js","three/addons/":"/three/examples/jsm/"}}</script>
<script type="module">
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const renderer = new THREE.WebGLRenderer({ preserveDrawingBuffer: true });
renderer.setSize(256, 256, false);
// Draw order by each object's place in the file, not three's ids (which follow the order loads finish): the same order
// for both copies.
const k = o => o.object.userData.k;
renderer.setOpaqueSort((a, b) => a.groupOrder - b.groupOrder || a.renderOrder - b.renderOrder || a.z - b.z || k(a) - k(b));
renderer.setTransparentSort((a, b) => a.groupOrder - b.groupOrder || a.renderOrder - b.renderOrder || b.z - a.z || k(a) - k(b));
const gl = renderer.getContext(), raw = document.createElement("canvas").getContext("webgl2");
const texels = img => {
  const t = raw.createTexture(); raw.bindTexture(raw.TEXTURE_2D, t);
  raw.pixelStorei(raw.UNPACK_FLIP_Y_WEBGL, false); raw.pixelStorei(raw.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false); raw.pixelStorei(raw.UNPACK_COLORSPACE_CONVERSION_WEBGL, raw.NONE);
  raw.texImage2D(raw.TEXTURE_2D, 0, raw.RGBA8, raw.RGBA, raw.UNSIGNED_BYTE, img);
  const fb = raw.createFramebuffer(); raw.bindFramebuffer(raw.FRAMEBUFFER, fb);
  raw.framebufferTexture2D(raw.FRAMEBUFFER, raw.COLOR_ATTACHMENT0, raw.TEXTURE_2D, t, 0);
  const px = new Uint8Array(img.width * img.height * 4); raw.readPixels(0, 0, img.width, img.height, raw.RGBA, raw.UNSIGNED_BYTE, px);
  raw.deleteFramebuffer(fb); raw.deleteTexture(t); return px;
};
const arr = a => { if (!a) return null; if (!a.isInterleavedBufferAttribute) return a.array; const out = new Float64Array(a.count * a.itemSize); for (let i = 0; i < a.count; i++) for (let k = 0; k < a.itemSize; k++) out[i * a.itemSize + k] = a.getComponent(i, k); return out; };
const sameArr = (x, y) => { if (!x || !y) return x === y; if (x.length !== y.length) return false; for (let i = 0; i < x.length; i++) if (x[i] !== y[i] && !(Number.isNaN(x[i]) && Number.isNaN(y[i]))) return false; return true; };
const TEX = ["wrapS", "wrapT", "magFilter", "minFilter", "flipY", "colorSpace", "channel", "generateMipmaps", "anisotropy", "premultiplyAlpha", "unpackAlignment"];
const plain = v => v?.isColor ? v.getHexString() : v?.isVector2 || v?.isVector3 || v?.isEuler ? v.toArray().join() : v;
function compareMaterial(a, b, at, out) {
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (["uuid", "id", "version", "_listeners"].includes(k)) continue;
    const x = a[k], y = b[k];
    if (x?.isTexture || y?.isTexture) {
      if (!x || !y) { out.push(at + "." + k + " missing"); continue; }
      for (const p of TEX) if (plain(x[p]) !== plain(y[p])) out.push(at + "." + k + "." + p);
      for (const p of ["offset", "repeat", "center"]) if (plain(x[p]) !== plain(y[p])) out.push(at + "." + k + "." + p);
      if (x.rotation !== y.rotation) out.push(at + "." + k + ".rotation");
      if (x.image.width !== y.image.width || x.image.height !== y.image.height || !sameArr(texels(x.image), texels(y.image))) out.push(at + "." + k + " texels");
      continue;
    }
    if (typeof x === "object" && x !== null && !x.isColor && !x.isVector2 && !x.isVector3 && !x.isEuler) { if (JSON.stringify(x) !== JSON.stringify(y)) out.push(at + "." + k); continue; }
    if (plain(x) !== plain(y) && !(Number.isNaN(x) && Number.isNaN(y))) out.push(at + "." + k);
  }
}
function compare(A, B) {
  const out = [], oa = [], ob = [];
  A.scene.traverse(o => oa.push(o)); B.scene.traverse(o => ob.push(o));
  if (oa.length !== ob.length) return ["node count " + oa.length + " vs " + ob.length];
  oa.forEach((a, i) => {
    const b = ob[i], at = a.name || i;
    if (a.type !== b.type || a.name !== b.name) out.push(at + " type/name");
    for (const p of ["position", "quaternion", "scale"]) if (!sameArr(a[p].toArray(), b[p].toArray())) out.push(at + "." + p);
    if (a.visible !== b.visible) out.push(at + ".visible");
    if (a.isMesh) {
      const ga = a.geometry, gb = b.geometry, keys = Object.keys(ga.attributes).sort();
      if (keys.join() !== Object.keys(gb.attributes).sort().join()) out.push(at + " attribute names");
      for (const k of keys) { const x = ga.attributes[k], y = gb.attributes[k]; if (!y || x.itemSize !== y.itemSize || x.normalized !== y.normalized || !sameArr(arr(x), arr(y))) out.push(at + "." + k); }
      if (!sameArr(arr(ga.index), arr(gb.index))) out.push(at + ".index");
      for (const k of Object.keys(ga.morphAttributes)) ga.morphAttributes[k].forEach((x, j) => { if (!sameArr(arr(x), arr(gb.morphAttributes[k]?.[j]))) out.push(at + ".morph." + k + j); });
      if (JSON.stringify(ga.groups) !== JSON.stringify(gb.groups)) out.push(at + ".groups");
      [a.material].flat().forEach((m, j) => compareMaterial(m, [b.material].flat()[j], at + ".material" + j, out));
      if (a.isSkinnedMesh) a.skeleton.bones.forEach((bone, j) => { if (bone.name !== b.skeleton.bones[j]?.name || !sameArr(a.skeleton.boneInverses[j].elements, b.skeleton.boneInverses[j].elements)) out.push(at + ".bone" + j); });
    }
  });
  if (A.animations.length !== B.animations.length) out.push("animation count");
  A.animations.forEach((c, i) => { const d = B.animations[i]; if (c.name !== d.name || c.duration !== d.duration || c.tracks.length !== d.tracks.length) { out.push("clip " + c.name); return; }
    c.tracks.forEach((t, j) => { const u = d.tracks[j]; if (t.name !== u.name || t.getInterpolation() !== u.getInterpolation() || !sameArr(t.times, u.times) || !sameArr(t.values, u.values)) out.push("track " + t.name); }); });
  return out;
}
function renders(gltf) {
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x808080);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x404040, 1.5));
  const sun = new THREE.DirectionalLight(0xffffff, 2); sun.position.set(3, 5, 2); scene.add(sun);
  let n = 0; gltf.scene.traverse(o => { o.userData.k = n++; });
  scene.add(gltf.scene); gltf.scene.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(gltf.scene), c = box.getCenter(new THREE.Vector3()), r = Math.max(box.getSize(new THREE.Vector3()).length() / 2, 1e-3);
  const cam = new THREE.PerspectiveCamera(40, 1, r / 100, r * 100), shots = [];
  for (const [x, y, z] of [[1, 0.6, 1], [-1, 0.4, 0.3], [0.2, 1.5, -1], [0, -0.5, 1]]) {
    cam.position.set(c.x + x * r * 2.2, c.y + y * r * 2.2, c.z + z * r * 2.2); cam.lookAt(c); cam.updateMatrixWorld();
    renderer.render(scene, cam); const px = new Uint8Array(256 * 256 * 4); gl.readPixels(0, 0, 256, 256, gl.RGBA, gl.UNSIGNED_BYTE, px); shots.push(px);
  }
  scene.remove(gltf.scene); return shots;
}
window.check = async p => {
  // One after the other: three breaks depth ties between objects by id, so both must be made in the same order.
  const A = await loader.loadAsync("/a" + p), B = await loader.loadAsync("/b" + p);
  const out = compare(A, B), ra = renders(A), rb = renders(B);
  ra.forEach((x, i) => { let n = 0; for (let k = 0; k < x.length; k++) n += x[k] !== rb[i][k]; if (n) out.push("render " + i + ": " + n + " bytes"); });
  // How much of the renders the model covers (not the grey backdrop): a check that there was something to compare.
  let drawn = 0; for (const x of ra) for (let k = 0; k < x.length; k += 4) drawn += x[k] !== x[k + 1] || x[k] !== x[k + 2] || Math.abs(x[k] - 128) > 2;
  return { out, drawn: drawn / (ra.length * 256 * 256) };
};
window.ready = true;
</script>`;

const types = { ".js": "text/javascript", ".glb": "model/gltf-binary", ".html": "text/html" };
const server = createServer((req, res) => {
  const u = decodeURIComponent(new URL(req.url, "http://x").pathname);
  const file = u === "/" ? null : u.startsWith("/three/") ? join(three, u.slice(7)) : u.startsWith("/a/") ? join(beforeRoot, u.slice(2)) : u.startsWith("/b/") ? join(afterRoot, u.slice(2)) : null;
  try { const body = file ? readFileSync(file) : PAGE; res.writeHead(200, { "content-type": file ? types[extname(file)] ?? "application/octet-stream" : "text/html" }); res.end(body); }
  catch { res.writeHead(404); res.end(); }
}).listen(0);
const port = server.address().port;
const browser = await chromium.launch({ channel: "chromium", headless: true, args: ["--mute-audio", "--use-angle=metal", "--ignore-gpu-blocklist"] });
const page = await browser.newPage();
page.on("pageerror", e => console.error("page error", e.message));
await page.goto(`http://localhost:${port}/`);
await page.waitForFunction(() => window.ready);
let bad = 0;
const cover = [];
for (const p of list) {
  const { out, drawn } = await page.evaluate(p => window.check(p).catch(e => ({ out: ["load failed: " + e.message], drawn: 0 })), p);
  cover.push(drawn);
  if (out.length) { bad++; console.log(`DIFFERENT ${p}: ${[...new Set(out)].slice(0, 8).join("; ")}`); }
}
console.log(`${list.length - bad} of ${list.length} GLBs identical as the game loads them (data, texels and four renders each); ${bad} differ`);
cover.sort((a, b) => a - b);
console.log(`the model's share of its renders: least ${(cover[0] * 100).toFixed(1)}%, median ${(cover[cover.length >> 1] * 100).toFixed(1)}%; none drawn in ${cover.filter(c => c === 0).length}`);
await browser.close();
server.close();
process.exit(bad ? 1 : 0);
