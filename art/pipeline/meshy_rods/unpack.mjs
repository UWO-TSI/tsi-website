// node unpack.mjs in.glb out.glb : decode meshopt/webp-free copy for Blender, print summary
import { createRequire } from "node:module";
const req = createRequire(new URL("../../../web/package.json", import.meta.url));
const { NodeIO } = req("@gltf-transform/core");
const { ALL_EXTENSIONS } = req("@gltf-transform/extensions");
const { MeshoptDecoder } = req("meshoptimizer");
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.decoder": MeshoptDecoder });
const [inp, out] = process.argv.slice(2);
const doc = await io.read(inp);
const root = doc.getRoot();
for (const s of root.listScenes()) console.log("SCENE extras", JSON.stringify(s.getExtras()));
let tris = 0; const mn=[1e9,1e9,1e9], mx=[-1e9,-1e9,-1e9];
for (const n of root.listNodes()) {
  const m = n.getMesh(); const wm = n.getWorldMatrix();
  let t = 0;
  if (m) for (const p of m.listPrimitives()) { const idx = p.getIndices(); t += (idx ? idx.getCount() : p.getAttribute("POSITION").getCount())/3;
    const pos = p.getAttribute("POSITION"); const v=[0,0,0];
    for (let i=0;i<pos.getCount();i++){ pos.getElement(i,v); const w=[0,1,2].map(r=>wm[r]*v[0]+wm[4+r]*v[1]+wm[8+r]*v[2]+wm[12+r]); for(let k=0;k<3;k++){mn[k]=Math.min(mn[k],w[k]);mx[k]=Math.max(mx[k],w[k]);} } }
  tris += t;
  console.log("NODE", n.getName(), "t", n.getTranslation().map(x=>+x.toFixed(4)), "r", n.getRotation().map(x=>+x.toFixed(3)), "s", n.getScale().map(x=>+x.toFixed(3)), m ? `mesh tris ${t} mats ${m.listPrimitives().map(p=>p.getMaterial()?.getName()).join(",")}` : "", JSON.stringify(n.getExtras()));
}
console.log("TRIS", tris, "BBOX", mn.map(x=>+x.toFixed(4)), mx.map(x=>+x.toFixed(4)));
for (const t of root.listTextures()) console.log("TEX", t.getName(), t.getMimeType(), t.getSize());
if (out) { for (const e of root.listExtensionsUsed()) if (e.extensionName === "EXT_meshopt_compression") e.dispose(); await io.write(out, doc); }
