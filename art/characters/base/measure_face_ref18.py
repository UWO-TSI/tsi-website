"""Eye placement and size measured on reference 18 through the v6 head (avatar-fit, replaces the '/cos 25 deg' guess).

  /Applications/Blender.app/Contents/MacOS/Blender -b -P art/characters/base/measure_face_ref18.py

Model: the reference is a 3/4 view; a point head_point(lat, lon) of the (measured) v6 head lands at image
x = xc + K * (x cos yaw - y sin yaw), K = 700 px per metre (body height). Unknowns yaw, the eye longitude, the iris
half-width (degrees of longitude) and a small shift of xc; knowns: both iris centres and widths (px, from
ref18_measurements.json), and the mouth on the centre line fixes xc. The iris and lid heights are read directly
(vertical sizes are not foreshortened in this view). Writes the "face_on_head" block of ref18_measurements.json.
"""
import json, math, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from head_shape import head_point, HC, HRZB, HRZT  # noqa: E402

PATH = os.path.join(HERE, "ref18_measurements.json")
M = json.load(open(PATH))
px = M["px"]
K = float(px["sole"] - px["bare_head_top"])      # px per metre (the body is 1 m tall)


def z_of_row(y):
    return 1 - (y - px["bare_head_top"]) / (px["sole"] - px["bare_head_top"])


def lat_of_z(z):
    t = (HC.z - z) / HRZB
    if t > 0:
        return -math.degrees(math.asin(min(1.0, t ** (1 / 0.62))))
    return math.degrees(math.asin(min(1.0, ((z - HC.z) / HRZT) ** (1 / 0.92))))


def ximg(lat, lon, yaw, xc):
    p = head_point(lat, lon) - HC
    return xc + K * (p.x * math.cos(yaw) - p.y * math.sin(yaw))


lat_e = lat_of_z(z_of_row(sum(px["iris_y"]) / 2))
lat_m = lat_of_z(z_of_row(px["mouth_y"]))
near_c, far_c = sum(px["iris_near_x"]) / 2, sum(px["iris_far_x"]) / 2
near_w, far_w = px["iris_near_x"][1] - px["iris_near_x"][0], px["iris_far_x"][1] - px["iris_far_x"][0]


def err(yaw_d, lon, hw, dxc):
    yaw = math.radians(yaw_d)
    xc = px["mouth_centre_x"] - ximg(lat_m, 0, yaw, 0) + dxc
    n0, f0 = ximg(lat_e, -lon, yaw, xc), ximg(lat_e, lon, yaw, xc)
    wn = abs(ximg(lat_e, -lon + hw, yaw, xc) - ximg(lat_e, -lon - hw, yaw, xc))
    wf = abs(ximg(lat_e, lon + hw, yaw, xc) - ximg(lat_e, lon - hw, yaw, xc))
    return (n0 - near_c) ** 2 + (f0 - far_c) ** 2 + (wn - near_w) ** 2 + (wf - far_w) ** 2 + 0.25 * dxc ** 2, xc


best = None
for yaw in range(0, 46, 2):                          # coarse
    for lon in range(10, 50, 2):
        for hw in range(4, 14, 2):
            for dxc in range(-24, 25, 4):
                e = err(yaw, lon, hw, dxc)[0]
                if best is None or e < best[0]:
                    best = (e, yaw, lon, hw, dxc)
_, y0, l0, h0, d0 = best
for k in range(-8, 9):                               # fine, one parameter pair at a time around the coarse best
    for j in range(-8, 9):
        for hw in (h0 - 1, h0 - 0.5, h0, h0 + 0.5, h0 + 1):
            for dxc in (d0 - 2, d0, d0 + 2):
                e = err(y0 + k * 0.25, l0 + j * 0.25, hw, dxc)[0]
                if e < best[0]:
                    best = (e, y0 + k * 0.25, l0 + j * 0.25, hw, dxc)
e, yaw, lon, hw, dxc = best


def arc_parallel(lat, lon, n=64):
    s, prev = 0.0, head_point(lat, 0)
    for i in range(1, n + 1):
        cur = head_point(lat, lon * i / n)
        s += (cur - prev).length
        prev = cur
    return s


px_m = K
out = {
    "method": "measure_face_ref18.py: yaw, eye longitude and iris half-width fitted to both iris centres and widths "
              "through the v6 head (orthographic 3/4 model, mouth on the centre line); heights read directly.",
    "rms_px": round(math.sqrt(e / 4), 2),
    "view_yaw_deg": round(yaw, 2),
    "eye_lat_deg": round(lat_e, 2),
    "eye_lon_deg": round(lon, 2),
    "eye_centre_arc_from_centre_line_m": round(arc_parallel(lat_e, lon), 4),
    "iris_width_arc_m": round(arc_parallel(lat_e, lon + hw) - arc_parallel(lat_e, lon - hw), 4),
    "iris_height_m": round((px["iris_y"][1] - px["iris_y"][0]) / px_m, 4),
    "lid_width_near_px_over_iris_width_near_px": round((px["lid_near_x"][1] - px["lid_near_x"][0]) / near_w, 3),
    "lid_top_above_eye_centre_m": round((sum(px["iris_y"]) / 2 - px["lid_top_y"]) / px_m, 4),
    "mouth_lat_deg": round(lat_m, 2),
}
M["face_on_head"] = out
json.dump(M, open(PATH, "w"), indent=2)
print("FACE_ON_HEAD", json.dumps(out))
