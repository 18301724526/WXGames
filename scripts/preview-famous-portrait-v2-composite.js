const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const projectRoot = path.join(__dirname, '..');
const layerDir = path.join(projectRoot, 'frontend', 'assets', 'art', 'famous-person', 'layers');
const outPath = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(projectRoot, 'tmp', 'famous-portrait-v2-art01-preview.png');
const manifest = JSON.parse(fs.readFileSync(path.join(layerDir, 'fp-layer-v2-manifest.json'), 'utf8'));
const order = ['backHair', 'body', 'innerwear', 'sideHair', 'frontHair', 'bangs', 'outfit'];
const files = {
  backHair: 'fp-layer-v2-art01-backHair-short-01.png',
  body: 'fp-layer-v2-art01-body-base-01.png',
  innerwear: 'fp-layer-v2-art01-innerwear-guardian-01.png',
  sideHair: 'fp-layer-v2-art01-sideHair-short-01.png',
  frontHair: 'fp-layer-v2-art01-frontHair-short-01.png',
  bangs: 'fp-layer-v2-art01-bangs-short-01.png',
  outfit: 'fp-layer-v2-art01-outfit-guardian-01.png',
};
const transforms = {
  backHair: { x: 72, y: 5, scale: 0.66 },
  body: { x: 72, y: 18, scale: 0.72 },
  innerwear: { x: 112, y: 80, scale: 0.48 },
  sideHair: { x: 118, y: 30, scale: 0.45 },
  frontHair: { x: 130, y: 20, scale: 0.44 },
  bangs: { x: 116, y: 65, scale: 0.36 },
  outfit: { x: 54, y: 160, scale: 0.82 },
};

function crc32(buffer) {
  let crc = ~0;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
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
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  const colorType = buffer[25];
  const bytesPerPixel = colorType === 6 ? 4 : 3;
  const stride = width * bytesPerPixel;
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
  let previous = Buffer.alloc(stride);
  for (let y = 0; y < height; y += 1) {
    const filter = raw[cursor];
    cursor += 1;
    const scanline = Buffer.from(raw.subarray(cursor, cursor + stride));
    cursor += stride;
    for (let i = 0; i < stride; i += 1) {
      const left = i >= bytesPerPixel ? scanline[i - bytesPerPixel] : 0;
      const up = previous[i];
      const upLeft = i >= bytesPerPixel ? previous[i - bytesPerPixel] : 0;
      if (filter === 1) scanline[i] = (scanline[i] + left) & 255;
      else if (filter === 2) scanline[i] = (scanline[i] + up) & 255;
      else if (filter === 3) scanline[i] = (scanline[i] + Math.floor((left + up) / 2)) & 255;
      else if (filter === 4) scanline[i] = (scanline[i] + paeth(left, up, upLeft)) & 255;
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
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]));
}

function blendPixel(target, x, y, r, g, b, a) {
  if (x < 0 || y < 0 || x >= target.width || y >= target.height || a <= 0) return;
  const index = (y * target.width + x) * 4;
  const sourceAlpha = a / 255;
  const destAlpha = target.pixels[index + 3] / 255;
  const outAlpha = sourceAlpha + destAlpha * (1 - sourceAlpha);
  if (outAlpha <= 0) return;
  target.pixels[index] = Math.round((r * sourceAlpha + target.pixels[index] * destAlpha * (1 - sourceAlpha)) / outAlpha);
  target.pixels[index + 1] = Math.round((g * sourceAlpha + target.pixels[index + 1] * destAlpha * (1 - sourceAlpha)) / outAlpha);
  target.pixels[index + 2] = Math.round((b * sourceAlpha + target.pixels[index + 2] * destAlpha * (1 - sourceAlpha)) / outAlpha);
  target.pixels[index + 3] = Math.round(outAlpha * 255);
}

function drawNearest(target, source, x, y, width, height) {
  const drawX = Math.round(x);
  const drawY = Math.round(y);
  const drawWidth = Math.max(1, Math.round(width));
  const drawHeight = Math.max(1, Math.round(height));
  for (let ty = 0; ty < drawHeight; ty += 1) {
    const sy = Math.min(source.height - 1, Math.floor((ty / drawHeight) * source.height));
    for (let tx = 0; tx < drawWidth; tx += 1) {
      const sx = Math.min(source.width - 1, Math.floor((tx / drawWidth) * source.width));
      const sourceIndex = (sy * source.width + sx) * 4;
      blendPixel(
        target,
        drawX + tx,
        drawY + ty,
        source.pixels[sourceIndex],
        source.pixels[sourceIndex + 1],
        source.pixels[sourceIndex + 2],
        source.pixels[sourceIndex + 3],
      );
    }
  }
}

const canvas = { width: 512, height: 512, pixels: Buffer.alloc(512 * 512 * 4) };
for (let i = 0; i < canvas.pixels.length; i += 4) {
  canvas.pixels[i] = 34;
  canvas.pixels[i + 1] = 27;
  canvas.pixels[i + 2] = 21;
  canvas.pixels[i + 3] = 255;
}

order.forEach((key) => {
  const file = files[key];
  const base = manifest.layers[file];
  const transform = transforms[key] || { x: 0, y: 0, scale: 1 };
  const image = readPng(path.join(layerDir, file));
  drawNearest(
    canvas,
    image,
    base.x + transform.x,
    base.y + transform.y,
    base.width * transform.scale,
    base.height * transform.scale,
  );
});

writePng(outPath, canvas);
console.log(outPath);
