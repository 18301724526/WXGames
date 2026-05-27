const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const projectRoot = path.join(__dirname, '..');
const outputDir = path.join(projectRoot, 'frontend', 'assets', 'art', 'famous-person', 'layers');
const SOURCE_SIZE = 512;
const SCALE = 3;
const CANVAS_SIZE = SOURCE_SIZE * SCALE;

function crc32(buffer) {
  let crc = ~0;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (~crc) >>> 0;
}

function writePng(filePath, image) {
  const stride = image.width * 4;
  const raw = Buffer.alloc((stride + 1) * image.height);
  for (let y = 0; y < image.height; y += 1) {
    raw[y * (stride + 1)] = 0;
    image.pixels.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  function chunk(type, data) {
    const typeBuffer = Buffer.from(type, 'ascii');
    const out = Buffer.alloc(12 + data.length);
    out.writeUInt32BE(data.length, 0);
    typeBuffer.copy(out, 4);
    data.copy(out, 8);
    out.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 8 + data.length);
    return out;
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(image.width, 0);
  ihdr.writeUInt32BE(image.height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  fs.writeFileSync(filePath, Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]));
}

function rgba(hex, alpha = 255) {
  const value = hex.replace('#', '');
  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
    alpha,
  ];
}

function createCanvas() {
  return { width: CANVAS_SIZE, height: CANVAS_SIZE, pixels: Buffer.alloc(CANVAS_SIZE * CANVAS_SIZE * 4) };
}

function blend(canvas, x, y, color) {
  if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) return;
  const [r, g, b, a] = color;
  if (a <= 0) return;
  const index = (y * canvas.width + x) * 4;
  const sourceAlpha = a / 255;
  const destAlpha = canvas.pixels[index + 3] / 255;
  const outAlpha = sourceAlpha + destAlpha * (1 - sourceAlpha);
  if (outAlpha <= 0) return;
  canvas.pixels[index] = Math.round((r * sourceAlpha + canvas.pixels[index] * destAlpha * (1 - sourceAlpha)) / outAlpha);
  canvas.pixels[index + 1] = Math.round((g * sourceAlpha + canvas.pixels[index + 1] * destAlpha * (1 - sourceAlpha)) / outAlpha);
  canvas.pixels[index + 2] = Math.round((b * sourceAlpha + canvas.pixels[index + 2] * destAlpha * (1 - sourceAlpha)) / outAlpha);
  canvas.pixels[index + 3] = Math.round(outAlpha * 255);
}

function toPx(value) {
  return Math.round(value * SCALE);
}

function pointInPolygon(x, y, points) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
    const xi = points[i][0];
    const yi = points[i][1];
    const xj = points[j][0];
    const yj = points[j][1];
    const intersect = ((yi > y) !== (yj > y))
      && (x < ((xj - xi) * (y - yi)) / (yj - yi || 1) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

function polygon(canvas, points, fill, outline = null) {
  const scaled = points.map(([x, y]) => [toPx(x), toPx(y)]);
  const minX = Math.max(0, Math.floor(Math.min(...scaled.map((point) => point[0]))));
  const maxX = Math.min(canvas.width - 1, Math.ceil(Math.max(...scaled.map((point) => point[0]))));
  const minY = Math.max(0, Math.floor(Math.min(...scaled.map((point) => point[1]))));
  const maxY = Math.min(canvas.height - 1, Math.ceil(Math.max(...scaled.map((point) => point[1]))));
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      if (pointInPolygon(x + 0.5, y + 0.5, scaled)) blend(canvas, x, y, fill);
    }
  }
  if (outline) {
    for (let i = 0; i < points.length; i += 1) {
      const next = (i + 1) % points.length;
      line(canvas, points[i][0], points[i][1], points[next][0], points[next][1], outline, 2.2);
    }
  }
}

function ellipse(canvas, cx, cy, rx, ry, fill, outline = null) {
  const minX = Math.max(0, toPx(cx - rx));
  const maxX = Math.min(canvas.width - 1, toPx(cx + rx));
  const minY = Math.max(0, toPx(cy - ry));
  const maxY = Math.min(canvas.height - 1, toPx(cy + ry));
  const pcx = cx * SCALE;
  const pcy = cy * SCALE;
  const prx = rx * SCALE;
  const pry = ry * SCALE;
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const nx = (x + 0.5 - pcx) / prx;
      const ny = (y + 0.5 - pcy) / pry;
      if (nx * nx + ny * ny <= 1) blend(canvas, x, y, fill);
    }
  }
  if (outline) {
    for (let angle = 0; angle < Math.PI * 2; angle += 0.01) {
      const x = cx + Math.cos(angle) * rx;
      const y = cy + Math.sin(angle) * ry;
      circle(canvas, x, y, 1.2, outline);
    }
  }
}

function circle(canvas, cx, cy, radius, fill) {
  ellipse(canvas, cx, cy, radius, radius, fill);
}

function line(canvas, x1, y1, x2, y2, color, width = 1) {
  const px1 = x1 * SCALE;
  const py1 = y1 * SCALE;
  const px2 = x2 * SCALE;
  const py2 = y2 * SCALE;
  const radius = Math.max(1, (width * SCALE) / 2);
  const minX = Math.max(0, Math.floor(Math.min(px1, px2) - radius));
  const maxX = Math.min(canvas.width - 1, Math.ceil(Math.max(px1, px2) + radius));
  const minY = Math.max(0, Math.floor(Math.min(py1, py2) - radius));
  const maxY = Math.min(canvas.height - 1, Math.ceil(Math.max(py1, py2) + radius));
  const dx = px2 - px1;
  const dy = py2 - py1;
  const lengthSquared = dx * dx + dy * dy || 1;
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const t = Math.max(0, Math.min(1, (((x - px1) * dx) + ((y - py1) * dy)) / lengthSquared));
      const cx = px1 + t * dx;
      const cy = py1 + t * dy;
      const distance = Math.hypot(x - cx, y - cy);
      if (distance <= radius) blend(canvas, x, y, color);
    }
  }
}

function crop(canvas) {
  let minX = canvas.width;
  let minY = canvas.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      const alpha = canvas.pixels[(y * canvas.width + x) * 4 + 3];
      if (alpha <= 0) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  if (maxX < minX || maxY < minY) throw new Error('Cannot crop empty layer.');
  const width = maxX - minX + 1;
  const height = maxY - minY + 1;
  const pixels = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    canvas.pixels.copy(
      pixels,
      y * width * 4,
      ((minY + y) * canvas.width + minX) * 4,
      ((minY + y) * canvas.width + minX + width) * 4,
    );
  }
  return {
    image: { width, height, pixels },
    layout: {
      x: Math.round(minX / SCALE),
      y: Math.round(minY / SCALE),
      width: Math.round(width / SCALE),
      height: Math.round(height / SCALE),
    },
  };
}

const skin = rgba('#c97633');
const skinLight = rgba('#df8b42');
const skinShadow = rgba('#9f552b');
const lineInk = rgba('#201714', 210);
const hair = rgba('#151515');
const hairMid = rgba('#202126');
const hairLight = rgba('#303037');
const armor = rgba('#34383d');
const armorDark = rgba('#24272c');
const armorLight = rgba('#59606a');
const brass = rgba('#a87a42');
const cloth = rgba('#172436');
const clothLight = rgba('#253955');

function drawBody(canvas) {
  polygon(canvas, [[205, 312], [307, 312], [322, 455], [190, 455]], skinShadow, lineInk);
  polygon(canvas, [[170, 450], [342, 450], [390, 512], [122, 512]], skin, null);
  ellipse(canvas, 139, 231, 28, 46, skin, lineInk);
  ellipse(canvas, 373, 231, 28, 46, skin, lineInk);
  ellipse(canvas, 256, 225, 96, 132, skin, lineInk);
  polygon(canvas, [[187, 160], [256, 124], [326, 160], [318, 220], [195, 220]], skinLight, null);
  polygon(canvas, [[209, 276], [256, 294], [303, 276], [292, 338], [256, 360], [220, 338]], skinShadow, null);
  polygon(canvas, [[243, 204], [258, 198], [269, 275], [251, 281]], skinShadow, null);
  line(canvas, 236, 286, 276, 285, lineInk, 2);
  line(canvas, 220, 205, 246, 198, lineInk, 3);
  line(canvas, 292, 198, 323, 205, lineInk, 3);
  ellipse(canvas, 231, 222, 15, 8, rgba('#251a12'), lineInk);
  ellipse(canvas, 297, 222, 15, 8, rgba('#251a12'), lineInk);
  circle(canvas, 232, 222, 4, rgba('#d5a05b'));
  circle(canvas, 298, 222, 4, rgba('#d5a05b'));
  line(canvas, 225, 314, 287, 314, lineInk, 2.2);
  line(canvas, 233, 326, 279, 326, rgba('#7f4128'), 1.7);
}

function drawBackHair(canvas) {
  polygon(canvas, [
    [137, 196], [151, 137], [190, 95], [244, 69], [302, 75], [350, 108],
    [378, 158], [379, 217], [353, 194], [333, 150], [291, 128], [239, 122],
    [194, 138], [162, 174],
  ], hair, lineInk);
  polygon(canvas, [[160, 188], [138, 254], [151, 312], [180, 253]], hairMid, null);
  polygon(canvas, [[352, 184], [378, 254], [361, 314], [332, 252]], hairMid, null);
  [
    [[166, 154], [221, 92], [207, 168]],
    [[207, 116], [260, 64], [254, 150]],
    [[254, 98], [315, 78], [292, 154]],
    [[306, 112], [359, 132], [318, 174]],
  ].forEach((points) => polygon(canvas, points, hairLight, null));
}

function drawSideHair(canvas) {
  polygon(canvas, [[151, 172], [174, 199], [164, 313], [141, 300], [137, 229]], hair, lineInk);
  polygon(canvas, [[361, 172], [338, 199], [348, 313], [371, 300], [375, 229]], hair, lineInk);
  line(canvas, 162, 197, 152, 287, hairLight, 2);
  line(canvas, 350, 197, 360, 287, hairLight, 2);
}

function drawFrontHair(canvas) {
  polygon(canvas, [
    [157, 166], [189, 118], [248, 97], [315, 112], [354, 159],
    [337, 184], [295, 158], [250, 150], [207, 160], [177, 190],
  ], hair, lineInk);
  polygon(canvas, [[183, 152], [236, 104], [224, 177]], hairMid, null);
  polygon(canvas, [[233, 126], [287, 105], [276, 171]], hairLight, null);
  polygon(canvas, [[286, 133], [334, 146], [302, 180]], hairMid, null);
}

function drawBangs(canvas) {
  polygon(canvas, [[202, 158], [239, 151], [226, 230]], hair, lineInk);
  polygon(canvas, [[235, 150], [270, 151], [255, 218]], hairMid, lineInk);
  polygon(canvas, [[267, 153], [306, 160], [281, 207]], hair, lineInk);
}

function drawInnerwear(canvas) {
  polygon(canvas, [[186, 367], [326, 367], [357, 512], [155, 512]], cloth, lineInk);
  polygon(canvas, [[218, 365], [256, 425], [294, 365], [276, 512], [236, 512]], clothLight, null);
  line(canvas, 256, 424, 256, 512, rgba('#0d1724'), 2);
  line(canvas, 215, 376, 245, 455, rgba('#0d1724'), 2);
  line(canvas, 297, 376, 267, 455, rgba('#0d1724'), 2);
}

function drawOutfit(canvas) {
  polygon(canvas, [[112, 430], [184, 352], [242, 392], [229, 512], [72, 512]], armor, lineInk);
  polygon(canvas, [[400, 430], [328, 352], [270, 392], [283, 512], [440, 512]], armor, lineInk);
  polygon(canvas, [[185, 356], [327, 356], [389, 512], [123, 512]], armorDark, lineInk);
  polygon(canvas, [[191, 359], [256, 419], [321, 359], [303, 456], [256, 492], [209, 456]], armor, lineInk);
  line(canvas, 176, 383, 234, 426, brass, 3);
  line(canvas, 336, 383, 278, 426, brass, 3);
  line(canvas, 142, 458, 225, 512, armorLight, 4);
  line(canvas, 370, 458, 287, 512, armorLight, 4);
  polygon(canvas, [[232, 460], [256, 438], [280, 460], [269, 500], [243, 500]], brass, lineInk);
  circle(canvas, 141, 475, 8, brass);
  circle(canvas, 371, 475, 8, brass);
}

const layers = [
  ['fp-layer-v2-backHair-short-01.png', drawBackHair],
  ['fp-layer-v2-body-base-01.png', drawBody],
  ['fp-layer-v2-innerwear-guardian-01.png', drawInnerwear],
  ['fp-layer-v2-outfit-guardian-01.png', drawOutfit],
  ['fp-layer-v2-sideHair-short-01.png', drawSideHair],
  ['fp-layer-v2-frontHair-short-01.png', drawFrontHair],
  ['fp-layer-v2-bangs-short-01.png', drawBangs],
];

function main() {
  fs.mkdirSync(outputDir, { recursive: true });
  const manifest = {
    version: 2,
    coordinateSize: SOURCE_SIZE,
    layers: {},
  };
  for (const [filename, draw] of layers) {
    const canvas = createCanvas();
    draw(canvas);
    const cropped = crop(canvas);
    writePng(path.join(outputDir, filename), cropped.image);
    manifest.layers[filename] = {
      x: cropped.layout.x,
      y: cropped.layout.y,
      width: Number((cropped.image.width / SCALE).toFixed(3)),
      height: Number((cropped.image.height / SCALE).toFixed(3)),
      sourcePixelWidth: cropped.image.width,
      sourcePixelHeight: cropped.image.height,
    };
    console.log(`${filename}: ${cropped.image.width}x${cropped.image.height} at ${cropped.layout.x},${cropped.layout.y}`);
  }
  fs.writeFileSync(
    path.join(outputDir, 'fp-layer-v2-manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
}

main();
