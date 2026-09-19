"""Builds public/og.png (1200x630), the link-preview image.

Void ground, a monster from 404_images/ dithered in Void and brand red with the
same 4x4 Bayer matrix as sinaida.eu, the wordmark in Geist Pixel with a neon
glow, the tagline, and the author line. Needs Pillow:  pip install pillow
Run from the repo root:  python3 scripts/generate-og.py
"""
import random
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
FONT_TTF = ROOT / "scripts" / "fonts" / "GeistPixel-Regular.ttf"   # Geist Pixel, SIL Open Font License
SOURCE = ROOT / "404_images" / "slopter_44.png"
OUT = ROOT / "public" / "og.png"

VOID = (5, 5, 5)
RED = (205, 0, 0)
RED_HOT = (255, 59, 59)
CHALK = (246, 246, 246)
FOG = (153, 153, 153)

W, H = 1200, 630
PANEL_X = 640                      # the monster panel starts here
BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]


def dither(img: Image.Image) -> Image.Image:
    """Two-tone ordered dither, same rule as subject_001/src/lib/ditherPreview.ts."""
    gray = img.convert("L")
    out = Image.new("RGB", gray.size, VOID)
    px, src = out.load(), gray.load()
    for y in range(gray.height):
        for x in range(gray.width):
            lum = src[x, y] / 255
            if lum > (BAYER[y % 4][x % 4] + 0.5) / 16:
                px[x, y] = RED
    return out


def font(size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(FONT_TTF), size)


def glow_text(base: Image.Image, xy, text, fnt, fill, glow=RED):
    """Text with a hot core and two wider halos (the welcome screen's neon)."""
    for radius, alpha in ((22, 150), (9, 200)):
        layer = Image.new("RGBA", base.size, (0, 0, 0, 0))
        ImageDraw.Draw(layer).text(xy, text, font=fnt, fill=glow + (alpha,))
        base.alpha_composite(layer.filter(ImageFilter.GaussianBlur(radius)))
    layer = Image.new("RGBA", base.size, (0, 0, 0, 0))
    ImageDraw.Draw(layer).text(xy, text, font=fnt, fill=fill + (255,))
    base.alpha_composite(layer)


def main() -> None:
    canvas = Image.new("RGBA", (W, H), VOID + (255,))

    # --- monster panel: cover-crop (favouring the top, where the face is), dither at half size, x2 ---
    panel_w, panel_h = W - PANEL_X, H
    cell = 2
    src = Image.open(SOURCE).convert("RGB")
    tw, th = panel_w // cell, panel_h // cell
    scale = max(tw / src.width, th / src.height)
    resized = src.resize((round(src.width * scale), round(src.height * scale)), Image.Resampling.LANCZOS)
    left = (resized.width - tw) // 2
    top = int((resized.height - th) * 0.55)
    crop = resized.crop((left, top, left + tw, top + th))
    panel = dither(crop).resize((panel_w, panel_h), Image.Resampling.NEAREST)
    canvas.paste(panel.convert("RGBA"), (PANEL_X, 0))
    ImageDraw.Draw(canvas).rectangle((PANEL_X, 0, PANEL_X + 3, H), fill=RED)  # red edge, like the site's panels

    # --- rare dithered stars on the left, as on the welcome screen ---
    rnd = random.Random(7)
    draw = ImageDraw.Draw(canvas)
    # Only in the clear areas: the strip above the wordmark and the lower right corner.
    for i in range(9):
        if i < 6:
            cx, cy = rnd.randrange(300, PANEL_X - 40, 6), rnd.randrange(24, 96, 6)
        else:
            cx, cy = rnd.randrange(500, PANEL_X - 40, 6), rnd.randrange(440, H - 30, 6)
        strength = rnd.uniform(0.5, 1.0)
        colour = RED if rnd.random() < 0.3 else CHALK
        for dx, dy, w in ((0, 0, 1), (1, 0, .75), (-1, 0, .75), (0, 1, .75), (0, -1, .75), (2, 0, .45), (-2, 0, .45), (0, 2, .45), (0, -2, .45)):
            if strength * w > (BAYER[(dy + 8) % 4][(dx + 8) % 4] + 0.5) / 16:
                draw.rectangle((cx + dx * 6, cy + dy * 6, cx + dx * 6 + 5, cy + dy * 6 + 5), fill=colour)

    # --- wordmark ---
    x0 = 72
    size = 118
    fnt = font(size)
    while max(fnt.getlength("INFINITE"), fnt.getlength("VOIDSONG")) > PANEL_X - x0 - 50:
        size -= 2
        fnt = font(size)
    y1 = 118
    draw.rectangle((x0 - 24, y1 + 6, x0 - 19, y1 + 2 * size + 4), fill=RED)  # the h1 bar
    glow_text(canvas, (x0, y1), "INFINITE", fnt, RED_HOT)
    glow_text(canvas, (x0, y1 + size + 4), "VOIDSONG", fnt, RED_HOT)

    # --- tagline and author ---
    tag = font(32)
    draw = ImageDraw.Draw(canvas)
    ty = y1 + 2 * size + 60
    draw.text((x0, ty), "Endless generated soundscapes", font=tag, fill=CHALK)
    draw.text((x0, ty + 44), "for focused work.", font=tag, fill=CHALK)
    small = font(26)
    draw.text((x0, H - 84), "Made by Sinaida  ·  sinaida.eu", font=small, fill=FOG)

    canvas.convert("RGB").save(OUT, optimize=True)
    print(f"wrote {OUT} ({OUT.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
