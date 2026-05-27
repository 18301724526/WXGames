const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const projectRoot = path.join(__dirname, '..');
const sourcePath = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(projectRoot, 'frontend', 'assets', 'art', 'famous-person', 'source', 'famous-portrait-layer-sheet-art01.png');
const outputDir = path.join(projectRoot, 'frontend', 'assets', 'art', 'famous-person', 'layers');
const coordinateSize = 512;

const layers = [
  { key: 'body', file: 'fp-layer-v2-art01-body-base-01.png', cell: 0 },
  { key: 'innerwear', file: 'fp-layer-v2-art01-innerwear-guardian-01.png', cell: 1 },
  { key: 'outfit', file: 'fp-layer-v2-art01-outfit-guardian-01.png', cell: 2 },
  { key: 'backHair', file: 'fp-layer-v2-art01-backHair-short-01.png', cell: 3 },
  { key: 'sideHair', file: 'fp-layer-v2-art01-sideHair-short-01.png', cell: 4 },
  { key: 'frontHair', file: 'fp-layer-v2-art01-frontHair-short-01.png', cell: 5 },
  { key: 'bangs', file: 'fp-layer-v2-art01-bangs-short-01.png', cell: 6 },
];

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

function paeth(left, up, upLeft) {
  const p = left + up - upLeft;
  const pa = Math.abs(p - left);
  const pb = Math.abs(p - up);
  const pc = Math.abs(p - upLeft);
  if (pa <= pb && pa <= pc) return left;
  return pb <= pc ? up : upLeft;
}

function readPng(filePath) {
  const buffer = fs.readFileSync(filePath);
  if (buffer.toString('hex', 0, 8) !== '89504e470d0a1a0a') {
    throw new Error(`Not a PNG file: ${filePath}`);
  }
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  const bitDepth = buffer[24];
  const colorType = buffer[25];
  const interlace = buffer[28];
  if (bitDepth !== 8 || interlace !== 0 || ![2, 6].includes(colorType)) {
    throw new Error(`Unsupported PNG format: bitDepth=${bitDepth}, colorType=${colorType}, interlace=${interlace}`);
  }

  const bytesPerPixel = colorType === 6 ? 4 : 3;
  const sourceStride = width * bytesPerPixel;
  const chunks = [];
  let offset = 8;
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    const dataStart = offset + 8;
    if (type === 'IDAT') chunks.push(buffer.subarray(dataStart, dataStart + length));
    if (type === 'IEND') break;
    offset = dataStart + length + 4;
  }

  const raw = zlib.inflateSync(Buffer.concat(chunks));
  const pixels = Buffer.alloc(width * height * 4);
  let cursor = 0;
  let previous = Buffer.alloc(sourceStride);
  for (let y = 0; y < height; y += 1) {
    const filter = raw[cursor];
    cursor += 1;
    const scanline = Buffer.from(raw.subarray(cursor, cursor + sourceStride));
    cursor += sourceStride;
    for (let i = 0; i < sourceStride; i += 1) {
      const left = i >= bytesPerPixel ? scanline[i - bytesPerPixel] : 0;
      const up = previous[i];
      const upLeft = i >= bytesPerPixel ? previous[i - bytesPerPixel] : 0;
      if (filter === 1) scanline[i] = (scanline[i] + left) & 255;
      else if (filter === 2) scanline[i] = (scanline[i] + up) & 255;
      else if (filter === 3) scanline[i] = (scanline[i] + Math.floor((left + up) / 2)) & 255;
      else if (filter === 4) scanline[i] = (scanline[i] + paeth(left, up, upLeft)) & 255;
      else if (filter !== 0) throw new Error(`Unsupported PNG filter: ${filter}`);
    }
    previous = scanline;

    for (let x = 0; x < width; x += 1) {
      const sourceIndex = x * bytesPerPixel;
      const targetIndex = (y * width + x) * 4;
      pixels[targetIndex] = scanline[sourceIndex];
      pixels[targetIndex + 1] = scanline[sourceIndex + 1];
      pixels[targetIndex + 2] = scanline[sourceIndex + 2];
      pixels[targetIndex + 3] = colorType === 6 ? scanline[sourceIndex + 3] : 255;
    }
  }
  return { width, height, pixels };
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

  fs.writeFileSync(filePath, Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]));
}

function backgroundAlpha(r, g, b, alpha) {
  const maxOther = Math.max(r, b);
  const greenDominance = g - maxOther;
  const hardGreen = g >= 130 && greenDominance >= 42 && g >= r * 1.22 && g >= b * 1.22;
  const softGreen = g >= 110 && greenDominance >= 26 && g >= r * 1.12 && g >= b * 1.12;
  const whiteGutter = r >= 242 && g >= 242 && b >= 242;
  const paleGreenKey = r >= 210 && g >= 220 && b >= 210 && g >= r && g >= b;
  if (whiteGutter || paleGreenKey || hardGreen) return 0;
  if (softGreen) return Math.round(alpha * Math.max(0, Math.min(1, (greenDominance - 26) / 16)));
  return alpha;
}

function extractCell(sheet, cellIndex) {
  const cols = 4;
  const rows = 2;
  const col = cellIndex % cols;
  const row = Math.floor(cellIndex / cols);
  const x0 = Math.round((sheet.width * col) / cols);
  const x1 = Math.round((sheet.width * (col + 1)) / cols);
  const y0 = Math.round((sheet.height * row) / rows);
  const y1 = Math.round((sheet.height * (row + 1)) / rows);
  const width = x1 - x0;
  const height = y1 - y0;
  const pixels = Buffer.alloc(width * height * 4);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const sourceIndex = ((y0 + y) * sheet.width + x0 + x) * 4;
      const targetIndex = (y * width + x) * 4;
      const r = sheet.pixels[sourceIndex];
      const g = sheet.pixels[sourceIndex + 1];
      const b = sheet.pixels[sourceIndex + 2];
      const sourceAlpha = sheet.pixels[sourceIndex + 3];
      const alpha = backgroundAlpha(r, g, b, sourceAlpha);
      pixels[targetIndex] = r;
      pixels[targetIndex + 1] = g;
      pixels[targetIndex + 2] = b;
      pixels[targetIndex + 3] = alpha;
      if (alpha === 0) {
        pixels[targetIndex] = 0;
        pixels[targetIndex + 1] = 0;
        pixels[targetIndex + 2] = 0;
      }
    }
  }

  return { width, height, pixels, sheetX: x0, sheetY: y0, cellX: x0, cellY: y0 };
}

function cropOpaque(image) {
  let minX = image.width;
  let minY = image.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const alpha = image.pixels[(y * image.width + x) * 4 + 3];
      if (alpha <= 8) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  if (maxX < minX || maxY < minY) {
    throw new Error('Cannot crop empty layer.');
  }

  const width = maxX - minX + 1;
  const height = maxY - minY + 1;
  const pixels = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    const sourceStart = ((minY + y) * image.width + minX) * 4;
    const sourceEnd = sourceStart + width * 4;
    image.pixels.copy(pixels, y * width * 4, sourceStart, sourceEnd);
  }
  return {
    width,
    height,
    pixels,
    offsetX: image.sheetX + minX,
    offsetY: image.sheetY + minY,
    cellX: image.cellX,
    cellY: image.cellY,
    cellWidth: image.width,
    cellHeight: image.height,
  };
}

function main() {
  const sheet = readPng(sourcePath);
  fs.mkdirSync(outputDir, { recursive: true });

  for (const filename of fs.readdirSync(outputDir)) {
    if (/^fp-layer-v2-.*\.png$/.test(filename)) {
      fs.unlinkSync(path.join(outputDir, filename));
    }
  }

  const manifest = {
    version: 2,
    source: path.basename(sourcePath),
    coordinateSize,
    layers: {},
  };

  layers.forEach((layer) => {
    const cropped = cropOpaque(extractCell(sheet, layer.cell));
    writePng(path.join(outputDir, layer.file), cropped);
    const cellOffsetX = cropped.offsetX - cropped.cellX;
    const cellOffsetY = cropped.offsetY - cropped.cellY;
    manifest.layers[layer.file] = {
      x: Number(((cellOffsetX / cropped.cellWidth) * coordinateSize).toFixed(3)),
      y: Number(((cellOffsetY / cropped.cellHeight) * coordinateSize).toFixed(3)),
      width: Number(((cropped.width / cropped.cellWidth) * coordinateSize).toFixed(3)),
      height: Number(((cropped.height / cropped.cellHeight) * coordinateSize).toFixed(3)),
      sourcePixelWidth: cropped.width,
      sourcePixelHeight: cropped.height,
      sourceSheetX: cropped.offsetX,
      sourceSheetY: cropped.offsetY,
    };
  });

  fs.writeFileSync(
    path.join(outputDir, 'fp-layer-v2-manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  console.log(`Extracted ${layers.length} layers from ${sourcePath}`);
}

main();
