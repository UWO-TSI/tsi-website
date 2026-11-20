#!/usr/bin/env python3
"""Family B model-sheet shots with the ElevenLabs image API (specs/asset-pipeline.md 1.1 to 1.3, 5).

  python3 art/pipeline/gen_sheet.py <asset-dir> <spec.json> [--only hero] [--contact]

Reads a spec {name, rarity, asset_text, views: [{file, view_line, canvas, ortho}]}, builds each prompt from the
sections' five blocks and posts it with the approved concept as an inline reference. Every view after the hero also
gets the hero's result as a generation reference. One take per view: a view already logged in <asset>.json is never
called again. Results go to <asset-dir>/<file>.png and each take is appended to <asset-dir>/<asset>.json.

The curl commands read the key from the XI environment variable, set from the keychain, so it never enters argv.
"""
import argparse
import base64
import json
import os
import re
import shlex
import subprocess
import sys
import tempfile
import time

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
STYLE_SHEET = os.path.join(ROOT, "art", "pipeline", "rod-style.md")
API = "https://api.elevenlabs.io/v1/flows/image"
MODEL = "gpt-image-2.5-sunburst"
RESOLUTION = "2K"
QUALITY = "high"
POLL_SECONDS = 10
POLL_LIMIT = 360

FRAME_ORTHO = "Orthographic projection, camera exactly level and on axis, no perspective."
FRAME_PERSP = "Gentle perspective."
MATCH = ("Exactly the same object as the reference image: the same parts, colours, materials, proportions and "
         "number of pieces. Change only the camera angle.")
MATCH_EXPLODED = ("Exactly the same object as the reference image, taken apart: the same parts, colours, materials "
                  "and proportions, every part shown once. Change only the spacing between the parts. No lines, "
                  "arrows, numbers or labels.")

ENV = dict(os.environ)


def style_paragraph(path):
    text = open(path, encoding="utf-8").read()
    m = re.search(r"^## The style, for the image model[ \t]*\n+(.*?)(?:\n[ \t]*\n|\Z)", text, re.M | re.S)
    if not m:
        sys.exit("style paragraph not found in " + path)
    return m.group(1).strip()


def build_prompt(spec, style, view):
    frame = ("A single object on a pure white background (#FFFFFF). No floor, no shadow, no text, no labels, "
             "no other objects. " + (FRAME_ORTHO if view["ortho"] else FRAME_PERSP) +
             " The object is centred and fills 80% of the image along its longest side; nothing is cropped. "
             "Soft, even studio light from the upper front-left.")
    blocks = [
        style,
        f"{spec['name']}, {spec['rarity']}: {spec['asset_text']}",
        view["view_line"],
        frame,
    ]
    if view["file"] != "hero":
        blocks.append(MATCH_EXPLODED if view["file"] == "exploded" else MATCH)
    return "\n\n".join(blocks)


def read_key():
    r = subprocess.run(["security", "find-generic-password", "-s", "elevenlabs-api-key", "-w"],
                       capture_output=True, text=True)
    if r.returncode != 0 or not r.stdout.strip():
        sys.exit("cannot read elevenlabs-api-key from the keychain")
    return r.stdout.strip()


def curl_json(method, url, body_path=None, timeout=120):
    cmd = f'curl -sS --max-time {timeout} -X {method} {shlex.quote(url)} -H "xi-api-key: $XI"'
    if body_path:
        cmd += ' -H "Content-Type: application/json" --data-binary @' + shlex.quote(body_path)
    cmd += " -w '\\n%{http_code}'"
    r = subprocess.run(["bash", "-c", cmd], capture_output=True, text=True, env=ENV)
    payload, _, code = r.stdout.rpartition("\n")
    if r.returncode != 0 and not code.strip():
        return 0, payload, r.stderr.strip()
    try:
        status = int(code.strip())
    except ValueError:
        status = 0
    return status, payload, r.stderr.strip()


def parse(payload):
    try:
        return json.loads(payload)
    except (ValueError, TypeError):
        return None


def credits_of(*objects):
    for obj in objects:
        if not isinstance(obj, dict):
            continue
        for key in ("credits", "credits_used"):
            value = obj.get(key)
            if isinstance(value, (int, float)):
                return value
        usage = obj.get("usage")
        if isinstance(usage, dict):
            for key in ("credits", "credits_used"):
                value = usage.get(key)
                if isinstance(value, (int, float)):
                    return value
    return None


def load_manifest(path):
    if os.path.exists(path):
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    return []


def save_manifest(path, entries):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(entries, f, indent=1)


def failure(entry, error):
    entry["error"] = error
    return entry


def generate(spec, view, asset_dir, manifest, style, hero_id):
    prompt = build_prompt(spec, style, view)
    entry = {"file": view["file"], "prompt": prompt, "model": MODEL, "generation_id": None, "credits": 0}

    concept_path = os.path.join(asset_dir, "approved.png")
    with open(concept_path, "rb") as f:
        concept = base64.b64encode(f.read()).decode("ascii")
    images = [{"type": "inline_base64", "content_base64": concept, "mime_type": "image/png"}]
    if view["file"] != "hero" and hero_id:
        images.append({"type": "generation", "generation_id": hero_id})
    elif view["file"] != "hero":
        print(f"{view['file']}: no hero generation reference available, using the concept only")

    payload = {
        "model_id": MODEL,
        "prompt": prompt,
        "aspect_ratio": view["canvas"],
        "resolution": RESOLUTION,
        "quality": QUALITY,
        "images": images,
    }
    with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False, encoding="utf-8") as f:
        json.dump(payload, f)
        body_path = f.name
    try:
        status, body, err = curl_json("POST", API, body_path)
    finally:
        os.unlink(body_path)

    if status in (401, 402, 403):
        parsed = parse(body)
        detail = parsed.get("detail", body) if isinstance(parsed, dict) else body
        sys.exit(f"{view['file']}: HTTP {status} from {API}: {detail}")
    if status != 200:
        manifest.append(failure(entry, f"HTTP {status}: {(body or err)[:400]}"))
        save_manifest(os.path.join(asset_dir, os.path.basename(asset_dir) + ".json"), manifest)
        print(f"{view['file']}: failed, HTTP {status}")
        return None

    created = parse(body) or {}
    gid = created.get("id")
    if not gid:
        manifest.append(failure(entry, f"no generation id: {body[:400]}"))
        save_manifest(os.path.join(asset_dir, os.path.basename(asset_dir) + ".json"), manifest)
        print(f"{view['file']}: failed, no generation id")
        return None
    entry["generation_id"] = gid
    print(f"{view['file']}: queued {gid}")

    deadline = time.time() + POLL_LIMIT
    result = None
    while time.time() < deadline:
        time.sleep(POLL_SECONDS)
        status, body, err = curl_json("GET", f"{API}/{gid}", timeout=60)
        if status != 200:
            print(f"{view['file']}: poll HTTP {status}, retrying")
            continue
        result = parse(body) or {}
        state = result.get("status")
        if state == "completed":
            break
        if state == "failed":
            reason = result.get("error_message") or result.get("failure_reason") or "failed"
            manifest.append(failure(entry, f"generation failed: {reason}"))
            save_manifest(os.path.join(asset_dir, os.path.basename(asset_dir) + ".json"), manifest)
            print(f"{view['file']}: generation failed: {reason}")
            return None
        result = None
    if not result:
        manifest.append(failure(entry, "poll timeout after 6 minutes"))
        save_manifest(os.path.join(asset_dir, os.path.basename(asset_dir) + ".json"), manifest)
        print(f"{view['file']}: failed, poll timeout after 6 minutes")
        return None

    entry["credits"] = credits_of(created, result)
    url = result.get("content_url")
    out_path = os.path.join(asset_dir, view["file"] + ".png")
    cmd = f'curl -sSL --max-time 180 -o {shlex.quote(out_path)} {shlex.quote(url)} -w "%{{http_code}}"'
    r = subprocess.run(["bash", "-c", cmd], capture_output=True, text=True, env=ENV)
    ok = (r.returncode == 0 and r.stdout.strip() == "200"
          and os.path.exists(out_path) and os.path.getsize(out_path) > 0)
    if not ok:
        manifest.append(failure(entry, f"download failed: HTTP {r.stdout.strip()} {r.stderr.strip()[:200]}".strip()))
        save_manifest(os.path.join(asset_dir, os.path.basename(asset_dir) + ".json"), manifest)
        print(f"{view['file']}: download failed")
        return None

    manifest.append({k: entry[k] for k in ("file", "prompt", "model", "generation_id", "credits")})
    save_manifest(os.path.join(asset_dir, os.path.basename(asset_dir) + ".json"), manifest)
    print(f"{view['file']}: wrote {out_path} (credits {entry['credits']})")
    return gid


def contact_sheet(asset_dir, views):
    from PIL import Image, ImageDraw, ImageFont

    files = [v["file"] for v in views if os.path.exists(os.path.join(asset_dir, v["file"] + ".png"))]
    if not files:
        print("contact: no results to compose")
        return False
    font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 22)
    cells = []
    for name in files:
        im = Image.open(os.path.join(asset_dir, name + ".png")).convert("RGB")
        im = im.resize((640, round(im.height * 640 / im.width)), Image.LANCZOS)
        cells.append((name, im))
    cols, pad, gap, cap = 3, 24, 24, 32
    rows = [cells[i:i + cols] for i in range(0, len(cells), cols)]
    row_heights = [max(im.height for _, im in row) + cap for row in rows]
    width = pad * 2 + cols * 640 + gap * (cols - 1)
    height = pad * 2 + sum(row_heights) + gap * (len(rows) - 1)
    sheet = Image.new("RGB", (width, height), "white")
    draw = ImageDraw.Draw(sheet)
    y = pad
    for row, row_height in zip(rows, row_heights):
        x = pad
        for name, im in row:
            draw.text((x, y), name + ".png", fill=(40, 40, 40), font=font)
            sheet.paste(im, (x, y + cap))
            x += 640 + gap
        y += row_height + gap
    out = os.path.join(asset_dir, "contact.jpg")
    sheet.save(out, quality=90)
    print(f"contact: wrote {out} ({len(cells)} results)")
    return True


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("asset_dir")
    ap.add_argument("spec")
    ap.add_argument("--only", default="", help="comma-separated view names to run (default: every view)")
    ap.add_argument("--contact", action="store_true", help="compose contact.jpg from the results and exit")
    args = ap.parse_args()

    asset_dir = os.path.abspath(args.asset_dir)
    spec = json.load(open(args.spec, encoding="utf-8"))
    views = spec["views"]
    if args.contact:
        sys.exit(0 if contact_sheet(asset_dir, views) else 1)

    ENV["XI"] = read_key()
    style = style_paragraph(STYLE_SHEET)

    manifest_name = os.path.basename(asset_dir) + ".json"
    manifest_path = os.path.join(asset_dir, manifest_name)
    manifest = load_manifest(manifest_path)
    logged = {e["file"] for e in manifest}
    hero = next((e for e in manifest if e["file"] == "hero" and e.get("generation_id")), None)
    hero_id = hero["generation_id"] if hero else None

    only = {s for s in args.only.split(",") if s}
    ran = 0
    for view in views:
        if only and view["file"] not in only:
            continue
        if view["file"] in logged:
            print(f"{view['file']}: skipped, already logged")
            continue
        gid = generate(spec, view, asset_dir, manifest, style, hero_id)
        ran += 1
        if view["file"] == "hero" and gid:
            hero_id = gid

    total = [e.get("credits") for e in load_manifest(manifest_path)]
    known = [c for c in total if isinstance(c, (int, float))]
    unknown = sum(1 for c in total if c is None)
    print(f"credits: {sum(known)} known across {len(total)} takes" +
          (f", {unknown} unknown" if unknown else ""))
    print(f"runs this call: {ran}")


if __name__ == "__main__":
    main()
