#!/usr/bin/env python3
"""
Generate premium Android launcher icons + splash screens for Jubilant LIRAS.

Design goals:
- Fintech / institutional look (dark gradient + subtle accent glows)
- Crisp geometric logo (JC monogram in gold)
- No external dependencies (pure Python + macOS `sips` for resizing)

This script overwrites Android resources under:
  jubilant/android/app/src/main/res/

Run from repo root:
  python3 jubilant/scripts/generate_android_brand_assets.py
"""

from __future__ import annotations

import math
import os
import re
import struct
import subprocess
import sys
import tempfile
import zlib


def clamp(x: float, a: float = 0.0, b: float = 1.0) -> float:
    return a if x < a else b if x > b else x


def lerp(a: float, b: float, t: float) -> float:
    return a + (b - a) * t


def srgb_to_linear(c: float) -> float:
    if c <= 0.04045:
        return c / 12.92
    return ((c + 0.055) / 1.055) ** 2.4


def linear_to_srgb(c: float) -> float:
    if c <= 0.0031308:
        return c * 12.92
    return 1.055 * (c ** (1 / 2.4)) - 0.055


def mix_rgb(c1: tuple[int, int, int], c2: tuple[int, int, int], t: float) -> tuple[int, int, int]:
    # gamma-correct mix
    t = clamp(t)
    r1, g1, b1 = (srgb_to_linear(v / 255.0) for v in c1)
    r2, g2, b2 = (srgb_to_linear(v / 255.0) for v in c2)
    r = linear_to_srgb(lerp(r1, r2, t))
    g = linear_to_srgb(lerp(g1, g2, t))
    b = linear_to_srgb(lerp(b1, b2, t))
    return (int(clamp(r) * 255), int(clamp(g) * 255), int(clamp(b) * 255))


def write_png(path: str, w: int, h: int, pixels_rgba8: bytes) -> None:
    stride = w * 4
    raw = bytearray()
    for y in range(h):
        raw.append(0)  # filter byte
        start = y * stride
        raw.extend(pixels_rgba8[start : start + stride])

    compressor = zlib.compressobj(level=9)
    comp = compressor.compress(bytes(raw)) + compressor.flush()

    def chunk(tag: bytes, data: bytes) -> bytes:
        return (
            struct.pack(">I", len(data))
            + tag
            + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        )

    png = bytearray()
    png.extend(b"\x89PNG\r\n\x1a\n")
    ihdr = struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0)
    png.extend(chunk(b"IHDR", ihdr))
    png.extend(chunk(b"IDAT", comp))
    png.extend(chunk(b"IEND", b""))

    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as f:
        f.write(png)


def blend_over(dst: tuple[float, float, float, float], src: tuple[float, float, float, float]) -> tuple[float, float, float, float]:
    dr, dg, db, da = dst
    sr, sg, sb, sa = src
    out_a = sa + da * (1.0 - sa)
    if out_a <= 1e-8:
        return (0.0, 0.0, 0.0, 0.0)
    out_r = (sr * sa + dr * da * (1.0 - sa)) / out_a
    out_g = (sg * sa + dg * da * (1.0 - sa)) / out_a
    out_b = (sb * sa + db * da * (1.0 - sa)) / out_a
    return (out_r, out_g, out_b, out_a)


def rgba_u8_to_f(c: tuple[int, int, int, int]) -> tuple[float, float, float, float]:
    r, g, b, a = c
    return (r / 255.0, g / 255.0, b / 255.0, a / 255.0)


def rgba_f_to_u8(c: tuple[float, float, float, float]) -> tuple[int, int, int, int]:
    r, g, b, a = c
    return (int(clamp(r) * 255), int(clamp(g) * 255), int(clamp(b) * 255), int(clamp(a) * 255))


def radial_alpha(x: float, y: float, cx: float, cy: float, r: float) -> float:
    d = math.hypot(x - cx, y - cy)
    t = clamp(1.0 - d / r)
    return t * t  # smoother falloff


def inside_rounded_rect(x: float, y: float, x0: float, y0: float, x1: float, y1: float, radius: float) -> bool:
    # Rounded rect with hard edge; best when downscaled from large base.
    if x < x0 or x > x1 or y < y0 or y > y1:
        return False
    rx = radius
    ry = radius
    # corners
    if x < x0 + rx and y < y0 + ry:
        return (x - (x0 + rx)) ** 2 + (y - (y0 + ry)) ** 2 <= rx * ry
    if x > x1 - rx and y < y0 + ry:
        return (x - (x1 - rx)) ** 2 + (y - (y0 + ry)) ** 2 <= rx * ry
    if x < x0 + rx and y > y1 - ry:
        return (x - (x0 + rx)) ** 2 + (y - (y1 - ry)) ** 2 <= rx * ry
    if x > x1 - rx and y > y1 - ry:
        return (x - (x1 - rx)) ** 2 + (y - (y1 - ry)) ** 2 <= rx * ry
    return True


def render_background(w: int, h: int) -> bytearray:
    # Palette
    c_top = (11, 18, 32)  # #0B1220
    c_bottom = (30, 41, 59)  # #1E293B
    glow_brand = (79, 70, 229)  # indigo-600
    glow_success = (16, 185, 129)  # emerald-500

    out = bytearray(w * h * 4)
    for y in range(h):
        for x in range(w):
            t = (x + y) / (w + h - 2)
            r, g, b = mix_rgb(c_top, c_bottom, t)

            # Subtle top-left brand glow
            a1 = 0.18 * radial_alpha(x, y, 0.22 * w, 0.18 * h, 0.65 * min(w, h))
            r = int(clamp((1 - a1) * r / 255.0 + a1 * glow_brand[0] / 255.0) * 255)
            g = int(clamp((1 - a1) * g / 255.0 + a1 * glow_brand[1] / 255.0) * 255)
            b = int(clamp((1 - a1) * b / 255.0 + a1 * glow_brand[2] / 255.0) * 255)

            # Subtle bottom-right success glow
            a2 = 0.12 * radial_alpha(x, y, 0.84 * w, 0.82 * h, 0.7 * min(w, h))
            r = int(clamp((1 - a2) * r / 255.0 + a2 * glow_success[0] / 255.0) * 255)
            g = int(clamp((1 - a2) * g / 255.0 + a2 * glow_success[1] / 255.0) * 255)
            b = int(clamp((1 - a2) * b / 255.0 + a2 * glow_success[2] / 255.0) * 255)

            i = (y * w + x) * 4
            out[i : i + 4] = bytes((r, g, b, 255))
    return out


def render_logo_layer(w: int, h: int, include_ring: bool = True, include_shadow: bool = True) -> bytearray:
    # Transparent background; draw the Jubilant Capital "JC" monogram.
    out = bytearray(w * h * 4)

    # Monogram path in a 512×512 design space (matches BrandMark in-app).
    # Bounding box for centering/scaling.
    bb_min_x, bb_min_y = 62.0, 130.0
    bb_max_x, bb_max_y = 396.0, 398.0
    bb_w = bb_max_x - bb_min_x
    bb_h = bb_max_y - bb_min_y

    # Scale to fit ~62% of width.
    target_w = w * 0.62
    scale = target_w / max(1.0, bb_w)
    off_x = (w - bb_w * scale) * 0.5 - bb_min_x * scale
    off_y = (h - bb_h * scale) * 0.5 - bb_min_y * scale

    # Stroke width (64 in 512 space).
    stroke = 64.0 * scale
    r = stroke * 0.5

    gold_a = (246, 231, 176)  # #f6e7b0
    gold_b = (202, 162, 74)  # #caa24a
    gold_hi = (243, 226, 165)  # #f3e2a5

    def put_pixel(xi: int, yi: int, src: tuple[int, int, int, int]) -> None:
        idx = (yi * w + xi) * 4
        dr, dg, db, da = (out[idx] / 255.0, out[idx + 1] / 255.0, out[idx + 2] / 255.0, out[idx + 3] / 255.0)
        sr, sg, sb, sa = rgba_u8_to_f(src)
        rr, rg, rb, ra = blend_over((dr, dg, db, da), (sr, sg, sb, sa))
        r8, g8, b8, a8 = rgba_f_to_u8((rr, rg, rb, ra))
        out[idx : idx + 4] = bytes((r8, g8, b8, a8))

    def to_xy(p: tuple[float, float], dx: float = 0.0, dy: float = 0.0) -> tuple[float, float]:
        return (p[0] * scale + off_x + dx, p[1] * scale + off_y + dy)

    def gold_at(y: float) -> tuple[int, int, int]:
        t = clamp(y / max(1.0, h))
        base = mix_rgb(gold_a, gold_b, t)
        # subtle highlight near the top
        hi = clamp(1.0 - (t / 0.28))
        return mix_rgb(base, gold_hi, 0.25 * hi)

    def draw_disc(cx: float, cy: float, radius: float, rgb: tuple[int, int, int], alpha: int) -> None:
        if alpha <= 0 or radius <= 0.0:
            return
        x0 = int(max(0, math.floor(cx - radius - 1)))
        x1 = int(min(w - 1, math.ceil(cx + radius + 1)))
        y0 = int(max(0, math.floor(cy - radius - 1)))
        y1 = int(min(h - 1, math.ceil(cy + radius + 1)))
        r2 = radius * radius
        for yi in range(y0, y1 + 1):
            dy = (yi + 0.5) - cy
            for xi in range(x0, x1 + 1):
                dx = (xi + 0.5) - cx
                if dx * dx + dy * dy <= r2:
                    put_pixel(xi, yi, (rgb[0], rgb[1], rgb[2], alpha))

    def approx_cubic_len(p0, p1, p2, p3) -> float:
        # Cheap length estimate by sampling.
        steps = 14
        last = p0
        total = 0.0
        for i in range(1, steps + 1):
            t = i / steps
            omt = 1.0 - t
            x = omt ** 3 * p0[0] + 3 * omt ** 2 * t * p1[0] + 3 * omt * t ** 2 * p2[0] + t ** 3 * p3[0]
            y = omt ** 3 * p0[1] + 3 * omt ** 2 * t * p1[1] + 3 * omt * t ** 2 * p2[1] + t ** 3 * p3[1]
            cur = (x, y)
            total += math.hypot(cur[0] - last[0], cur[1] - last[1])
            last = cur
        return total

    def draw_line(p0: tuple[float, float], p1: tuple[float, float], dx: float, dy: float, alpha: int, shadow: bool) -> None:
        x0, y0 = to_xy(p0, dx, dy)
        x1, y1 = to_xy(p1, dx, dy)
        dist = math.hypot(x1 - x0, y1 - y0)
        step = max(3.0, r * 0.35)
        n = max(1, int(dist / step))
        for i in range(n + 1):
            t = i / n
            x = lerp(x0, x1, t)
            y = lerp(y0, y1, t)
            rgb = (0, 0, 0) if shadow else gold_at(y)
            draw_disc(x, y, r, rgb, alpha)

    def draw_cubic(p0, p1, p2, p3, dx: float, dy: float, alpha: int, shadow: bool) -> None:
        q0 = to_xy(p0, dx, dy)
        q1 = to_xy(p1, dx, dy)
        q2 = to_xy(p2, dx, dy)
        q3 = to_xy(p3, dx, dy)
        length = approx_cubic_len(q0, q1, q2, q3)
        step = max(3.0, r * 0.35)
        n = max(18, int(length / step))
        for i in range(n + 1):
            t = i / n
            omt = 1.0 - t
            x = omt ** 3 * q0[0] + 3 * omt ** 2 * t * q1[0] + 3 * omt * t ** 2 * q2[0] + t ** 3 * q3[0]
            y = omt ** 3 * q0[1] + 3 * omt ** 2 * t * q1[1] + 3 * omt * t ** 2 * q2[1] + t ** 3 * q3[1]
            rgb = (0, 0, 0) if shadow else gold_at(y)
            draw_disc(x, y, r, rgb, alpha)

    def draw_monogram(dx: float, dy: float, alpha: int, shadow: bool) -> None:
        # J
        draw_line((176, 134), (260, 134), dx, dy, alpha, shadow)
        draw_line((260, 134), (260, 290), dx, dy, alpha, shadow)
        draw_cubic((260, 290), (260, 356), (218, 398), (154, 398), dx, dy, alpha, shadow)
        draw_cubic((154, 398), (114, 398), (82, 382), (62, 354), dx, dy, alpha, shadow)

        # C
        draw_cubic((396, 182), (374, 150), (340, 130), (300, 130), dx, dy, alpha, shadow)
        draw_cubic((300, 130), (230, 130), (176, 186), (176, 256), dx, dy, alpha, shadow)
        draw_cubic((176, 256), (176, 326), (230, 382), (300, 382), dx, dy, alpha, shadow)
        draw_cubic((300, 382), (340, 382), (374, 362), (396, 330), dx, dy, alpha, shadow)

    if include_shadow:
        # Two-pass shadow for depth.
        draw_monogram(r * 0.10, r * 0.14, 70, True)
        draw_monogram(r * 0.18, r * 0.26, 40, True)

    draw_monogram(0.0, 0.0, 255, False)

    return out


def composite(bg: bytes, fg: bytes, w: int, h: int) -> bytearray:
    out = bytearray(w * h * 4)
    for i in range(0, w * h * 4, 4):
        dr, dg, db, da = (bg[i] / 255.0, bg[i + 1] / 255.0, bg[i + 2] / 255.0, bg[i + 3] / 255.0)
        sr, sg, sb, sa = (fg[i] / 255.0, fg[i + 1] / 255.0, fg[i + 2] / 255.0, fg[i + 3] / 255.0)
        rr, rg, rb, ra = blend_over((dr, dg, db, da), (sr, sg, sb, sa))
        r8, g8, b8, a8 = rgba_f_to_u8((rr, rg, rb, ra))
        out[i : i + 4] = bytes((r8, g8, b8, a8))
    return out


def sips_resize(src: str, dst: str, w: int, h: int) -> None:
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    subprocess.check_call(["sips", "-z", str(h), str(w), src, "--out", dst], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def sips_crop_to(src: str, dst: str, crop_w: int, crop_h: int) -> None:
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    subprocess.check_call(
        ["sips", "--cropToHeightWidth", str(crop_h), str(crop_w), src, "--out", dst],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


def splash_targets(res_root: str) -> list[tuple[str, int, int]]:
    targets: list[tuple[str, int, int]] = []
    for dirpath, _, filenames in os.walk(res_root):
        for fn in filenames:
            if fn != "splash.png":
                continue
            path = os.path.join(dirpath, fn)
            out = subprocess.check_output(["sips", "-g", "pixelWidth", "-g", "pixelHeight", path], text=True)
            m = re.findall(r"pixel(Width|Height):\\s*(\\d+)", out)
            d = {k: int(v) for k, v in m}
            w = int(d.get("Width", 0))
            h = int(d.get("Height", 0))
            if w and h:
                targets.append((path, w, h))
    return targets


def main() -> int:
    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    res_root = os.path.join(repo_root, "android", "app", "src", "main", "res")

    if not os.path.isdir(res_root):
        print(f"ERROR: Android res folder not found: {res_root}", file=sys.stderr)
        return 2

    with tempfile.TemporaryDirectory() as tmp:
        icon_bg = os.path.join(tmp, "icon_bg.png")
        icon_fg = os.path.join(tmp, "icon_fg.png")
        icon_full = os.path.join(tmp, "icon_full.png")
        splash_base = os.path.join(tmp, "splash_base.png")

        # Base renders
        bg_pixels = render_background(1024, 1024)
        fg_pixels = render_logo_layer(1024, 1024, include_ring=True, include_shadow=True)
        full_pixels = composite(bg_pixels, fg_pixels, 1024, 1024)

        write_png(icon_bg, 1024, 1024, bg_pixels)
        write_png(icon_fg, 1024, 1024, fg_pixels)
        write_png(icon_full, 1024, 1024, full_pixels)

        splash_bg = render_background(2048, 2048)
        splash_logo = render_logo_layer(2048, 2048, include_ring=True, include_shadow=False)
        splash_pixels = composite(splash_bg, splash_logo, 2048, 2048)
        write_png(splash_base, 2048, 2048, splash_pixels)

        # Launcher icons (mipmap densities)
        mipmap_sizes = {
            "mipmap-ldpi": 36,
            "mipmap-mdpi": 48,
            "mipmap-hdpi": 72,
            "mipmap-xhdpi": 96,
            "mipmap-xxhdpi": 144,
            "mipmap-xxxhdpi": 192,
        }

        for folder, px in mipmap_sizes.items():
            out_dir = os.path.join(res_root, folder)
            sips_resize(icon_full, os.path.join(out_dir, "ic_launcher.png"), px, px)
            sips_resize(icon_full, os.path.join(out_dir, "ic_launcher_round.png"), px, px)
            sips_resize(icon_bg, os.path.join(out_dir, "ic_launcher_background.png"), px, px)
            sips_resize(icon_fg, os.path.join(out_dir, "ic_launcher_foreground.png"), px, px)

        # Splash screens (all variants already in the project)
        targets = splash_targets(res_root)
        for path, w, h in targets:
            # crop base square to match aspect ratio, then resize
            if w == h:
                crop_w = crop_h = 2048
            elif w < h:
                crop_h = 2048
                crop_w = int(round(crop_h * (w / h)))
            else:
                crop_w = 2048
                crop_h = int(round(crop_w * (h / w)))

            cropped = os.path.join(tmp, f"crop_{crop_w}x{crop_h}.png")
            sips_crop_to(splash_base, cropped, crop_w, crop_h)
            sips_resize(cropped, path, w, h)

        # iOS app icon (single 1024×1024 image in this project)
        ios_icon = os.path.join(repo_root, "ios", "App", "App", "Assets.xcassets", "AppIcon.appiconset", "AppIcon-512@2x.png")
        if os.path.isfile(ios_icon):
            sips_resize(icon_full, ios_icon, 1024, 1024)

        # Web/PWA icons (copied to dist via Vite public/)
        web_icons_dir = os.path.join(repo_root, "public", "icons")
        os.makedirs(web_icons_dir, exist_ok=True)
        for px in (48, 72, 96, 128, 192, 256, 512):
            sips_resize(icon_full, os.path.join(web_icons_dir, f"icon-{px}.png"), px, px)
        sips_resize(icon_full, os.path.join(repo_root, "public", "favicon.png"), 64, 64)

    print("✅ Updated Android launcher icons + splash screens.")
    print("✅ Updated iOS app icon + Web/PWA icons.")
    print("Next: run `cd jubilant && npx cap sync android` then rebuild APK/AAB in Android Studio.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
