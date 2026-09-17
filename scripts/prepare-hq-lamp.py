"""Import existing HQ furniture sources with their original atlases.
Usage: python3 scripts/prepare-hq-lamp.py /path/to/Assets/Model [FtrWoodenTableMini reading-table]
Lamp uses variant 0; reading table uses body 0 and green cloth 4.
Sofa uses cream body 4, simple ceiling pendant uses white body 1;
other lounge pieces use original variant 0.
Requires the existing assimp CLI. No authored replacement geometry.
"""
import json
from pathlib import Path
import shutil
import struct
import subprocess
import sys
import tempfile

source = Path(sys.argv[1])
model = sys.argv[2] if len(sys.argv) > 2 else 'FtrLamp'
output = sys.argv[3] if len(sys.argv) > 3 else 'floor-lamp'
with tempfile.TemporaryDirectory(prefix='tethos-hq-lamp-') as tmp:
    work = Path(tmp)
    shutil.copyfile(source / f'{model}.Nin_NX_NVN/{model}.dae', work / 'lamp.dae')
    folders = [source / f'{model}.Nin_NX_NVN', *source.glob(f'{model}Re*0.Nin_NX_NVN')]
    if model == 'FtrWoodenTableMini':
        folders.append(source / 'FtrWoodenTableMiniReFabric4.Nin_NX_NVN')
    if model == 'FtrLightSimpleCeiling':
        folders.append(source / 'FtrLightSimpleCeilingReBody1.Nin_NX_NVN')
    if model == 'FtrSofaL':
        folders.append(source / 'FtrSofaLReBody4.Nin_NX_NVN')
    for folder in folders:
        for image in folder.glob('*.png'):
            shutil.copyfile(image, work / image.name)
    subprocess.run(['assimp', 'export', str(work/'lamp.dae'), str(work/'lamp.glb'), '-fglb2', '-ptv'], check=True, stdout=subprocess.DEVNULL)
    raw = (work/'lamp.glb').read_bytes()
    length = struct.unpack_from('<I', raw, 12)[0]
    doc = json.loads(raw[20:20+length])
    binary = bytearray(raw[28+length:])
    # ACNH Mix/normal maps aren't standard glTF PBR inputs. Keep original
    # albedo and the lampshade's explicit emission mask, not guessed channels.
    for material in doc['materials']:
        material.pop('normalTexture', None)
        material.pop('extensions', None)
        material['doubleSided'] = True
        material['pbrMetallicRoughness']['roughnessFactor'] = 0.85
        if model == 'FtrLamp' and material['name'] == 'mReFabric':
            material['emissiveFactor'] = [1, 0.68, 0.34]
        else:
            material.pop('emissiveTexture', None)
            material.pop('emissiveFactor', None)
    used = sorted({m['pbrMetallicRoughness']['baseColorTexture']['index'] for m in doc['materials']} | {m['emissiveTexture']['index'] for m in doc['materials'] if 'emissiveTexture' in m})
    remap = {old: new for new, old in enumerate(used)}
    images, textures = [], []
    for index in used:
        texture = doc['textures'][index]
        name = Path(doc['images'][texture['source']]['uri']).with_suffix('.png').name
        data = (work/name).read_bytes()
        binary.extend(b'\0' * (-len(binary) % 4))
        images.append({'name': name, 'mimeType': 'image/png', 'bufferView': len(doc['bufferViews'])})
        doc['bufferViews'].append({'buffer': 0, 'byteOffset': len(binary), 'byteLength': len(data)})
        binary.extend(data)
        textures.append({'source': len(images)-1, 'sampler': texture.get('sampler', 0)})
    for material in doc['materials']:
        base = material['pbrMetallicRoughness']['baseColorTexture'];base['index'] = remap[base['index']]
        if 'emissiveTexture' in material:
            tex = material['emissiveTexture'];tex['index'] = remap[tex['index']]
    doc['images'],doc['textures'] = images,textures
    doc.pop('extensionsUsed',None);doc.pop('extensionsRequired',None)
    doc['buffers'][0]['byteLength'] = len(binary)
    binary.extend(b'\0' * (-len(binary) % 4))
    encoded = json.dumps(doc,separators=(',',':')).encode();encoded += b' ' * (-len(encoded) % 4)
    out = Path(__file__).resolve().parents[1]/f'web/public/assets/acnh/furniture/{output}.glb'
    out.write_bytes(struct.pack('<III',0x46546C67,2,28+len(encoded)+len(binary))+struct.pack('<II',len(encoded),0x4E4F534A)+encoded+struct.pack('<II',len(binary),0x004E4942)+binary)
    print(out, out.stat().st_size, 'bytes; original meshes;', len(images), 'embedded source maps')
