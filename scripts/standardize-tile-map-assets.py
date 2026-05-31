from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
TILE_DIR = ROOT / "frontend" / "assets" / "art" / "tile-map"

TARGET_BOUNDS = (44, 150, 424, 212)
ALPHA_THRESHOLD = 8
MASK_SCALE = 4
BLEED_ITERATIONS = 8
OCEAN_EDGE_KEYS = ["nw", "ne", "se", "sw"]
OCEAN_ADJACENT_EDGE_KEYS = ["nw-ne", "ne-se", "se-sw", "nw-sw"]
OCEAN_RIVER_MOUTH_RIVER_KEYS = {
    "nw": "nw-se",
    "ne": "ne-sw",
    "se": "nw-se",
    "sw": "ne-sw",
}
OCEAN_TEMPLATE_FILES = [
    "tile-ocean-water-full.png",
    *(f"tile-ocean-shore-edge-{key}.png" for key in OCEAN_EDGE_KEYS),
    *(f"tile-ocean-shore-edges-{key}.png" for key in OCEAN_ADJACENT_EDGE_KEYS),
    *(f"tile-ocean-river-mouth-{key}.png" for key in OCEAN_EDGE_KEYS),
    "tile-ocean-shore-corner-n.png",
    "tile-ocean-shore-corner-e.png",
    "tile-ocean-shore-corner-s.png",
    "tile-ocean-shore-corner-w.png",
]


def alpha_bounds(image):
    alpha = image.getchannel("A")
    mask = alpha.point(lambda value: 255 if value > ALPHA_THRESHOLD else 0)
    return mask.getbbox()


def make_iso_mask(width, height):
    large_size = (width * MASK_SCALE, height * MASK_SCALE)
    mask = Image.new("L", large_size, 0)
    draw = ImageDraw.Draw(mask)
    draw.polygon(
        [
            (large_size[0] * 0.5, 0),
            (large_size[0], large_size[1] * 0.5),
            (large_size[0] * 0.5, large_size[1]),
            (0, large_size[1] * 0.5),
        ],
        fill=255,
    )
    return mask.resize((width, height), Image.Resampling.LANCZOS)


def water_color_mask(image):
    pixels = image.load()
    mask = Image.new("L", image.size, 0)
    mask_pixels = mask.load()
    for y in range(image.height):
        for x in range(image.width):
            red, green, blue, alpha = pixels[x, y]
            if alpha <= 56 or blue <= 70:
                continue
            if blue > red + 12 and blue > green - 3 and (green > red + 18 or blue > 112):
                mask_pixels[x, y] = 255
    return mask


def bleed_rgb(image, iterations=BLEED_ITERATIONS):
    result = image.copy()
    for _ in range(iterations):
        alpha = result.getchannel("A")
        grown_alpha = alpha.filter(ImageFilter.MaxFilter(3))
        ring = ImageChops.subtract(grown_alpha, alpha)
        if not ring.getbbox():
            break
        expanded = result.filter(ImageFilter.MaxFilter(3))
        result = Image.composite(expanded, result, ring)
        result.putalpha(alpha)
    return result


def resize_into_standard_bounds(image, source_bounds, alpha_mode):
    target_x, target_y, target_w, target_h = TARGET_BOUNDS
    source = bleed_rgb(image).crop(source_bounds)
    resized = source.resize((target_w, target_h), Image.Resampling.LANCZOS)
    red, green, blue, alpha = resized.split()
    iso_mask = make_iso_mask(target_w, target_h)

    if alpha_mode == "solid":
        next_alpha = iso_mask
    elif alpha_mode == "standard-with-holes":
        hole_mask = ImageChops.multiply(
            alpha.point(lambda value: 0 if value > ALPHA_THRESHOLD else 255),
            iso_mask.point(lambda value: 255 if value >= 250 else 0),
        )
        hole_mask = ImageChops.lighter(hole_mask, water_color_mask(resized))
        next_alpha = ImageChops.subtract(iso_mask, hole_mask)
    else:
        next_alpha = ImageChops.multiply(alpha, iso_mask)

    output = Image.new("RGBA", image.size, (0, 0, 0, 0))
    output.paste(Image.merge("RGBA", (red, green, blue, next_alpha)), (target_x, target_y))
    return output


def standardize_solid_tile(path):
    image = Image.open(path).convert("RGBA")
    bounds = alpha_bounds(image)
    if not bounds:
        return False
    output = resize_into_standard_bounds(image, bounds, "solid")
    output.save(path)
    return True


def standardize_template(path, source_bounds, alpha_mode):
    image = Image.open(path).convert("RGBA")
    if path.name == "tile-ocean-water-full.png":
        Image.new("RGBA", image.size, (0, 0, 0, 0)).save(path)
        return True
    if not alpha_bounds(image):
        return False
    output = resize_into_standard_bounds(image, source_bounds, alpha_mode)
    output.save(path)
    return True


def transparent_hole_mask(image, terrain_alpha):
    alpha = image.getchannel("A")
    inside_terrain = terrain_alpha.point(lambda value: 255 if value > 32 else 0)
    transparent = alpha.point(lambda value: 255 if value <= ALPHA_THRESHOLD else 0)
    return ImageChops.multiply(inside_terrain, transparent)


def generate_ocean_adjacent_edge_templates():
    ocean_dir = TILE_DIR / "ocean-template"
    plains = Image.open(TILE_DIR / "tile-terrain-plains.png").convert("RGBA")
    terrain_alpha = plains.getchannel("A")
    source_masks = {}
    for side in OCEAN_EDGE_KEYS:
        source = Image.open(ocean_dir / f"tile-ocean-shore-edge-{side}.png").convert("RGBA")
        source_masks[side] = transparent_hole_mask(source, terrain_alpha)

    red, green, blue, base_alpha = plains.split()
    for key in OCEAN_ADJACENT_EDGE_KEYS:
        hole = Image.new("L", plains.size, 0)
        for side in key.split("-"):
            hole = ImageChops.lighter(hole, source_masks[side])
        alpha = ImageChops.subtract(base_alpha, hole)
        output = Image.merge("RGBA", (red, green, blue, alpha))
        output.save(ocean_dir / f"tile-ocean-shore-edges-{key}.png")


def generate_ocean_river_mouth_templates():
    ocean_dir = TILE_DIR / "ocean-template"
    river_dir = TILE_DIR / "river-template"
    plains = Image.open(TILE_DIR / "tile-terrain-plains.png").convert("RGBA")
    terrain_alpha = plains.getchannel("A")
    for side in OCEAN_EDGE_KEYS:
        shore = Image.open(ocean_dir / f"tile-ocean-shore-edge-{side}.png").convert("RGBA")
        river_key = OCEAN_RIVER_MOUTH_RIVER_KEYS[side]
        river = Image.open(river_dir / f"tile-river-bank-uv-{river_key}.png").convert("RGBA")
        shore_hole = transparent_hole_mask(shore, terrain_alpha)
        river_hole = transparent_hole_mask(river, terrain_alpha)
        hole = ImageChops.lighter(shore_hole, river_hole)
        red, green, blue, _alpha = shore.split()
        alpha = ImageChops.subtract(terrain_alpha, hole)
        output = Image.merge("RGBA", (red, green, blue, alpha))
        output.save(ocean_dir / f"tile-ocean-river-mouth-{side}.png")


def main():
    plains_path = TILE_DIR / "tile-terrain-plains.png"
    plains = Image.open(plains_path).convert("RGBA")
    plains_source_bounds = alpha_bounds(plains)
    if not plains_source_bounds:
        raise RuntimeError("tile-terrain-plains.png has no alpha footprint")

    changed = []
    for path in sorted(TILE_DIR.glob("tile-terrain-*.png")):
        if standardize_solid_tile(path):
            changed.append(path)

    template_dirs = {
        TILE_DIR / "river-template": "standard-with-holes",
        TILE_DIR / "transition-template": "solid",
        TILE_DIR / "ocean-template": "standard-with-holes",
    }
    for template_dir, alpha_mode in template_dirs.items():
        if not template_dir.exists():
            continue
        for path in sorted(template_dir.glob("*.png")):
            if standardize_template(path, plains_source_bounds, alpha_mode):
                changed.append(path)

    generate_ocean_adjacent_edge_templates()
    generate_ocean_river_mouth_templates()
    changed.extend((TILE_DIR / "ocean-template" / file_name) for file_name in OCEAN_TEMPLATE_FILES)

    for path in changed:
        print(path.relative_to(ROOT))


if __name__ == "__main__":
    main()
