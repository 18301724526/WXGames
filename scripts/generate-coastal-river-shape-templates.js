const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const projectRoot = path.join(__dirname, '..');
const tileMapDir = path.join(projectRoot, 'frontend', 'assets', 'art', 'tile-map');
const outputDir = path.join(tileMapDir, 'coastal-river-shape-template');
const sideKeys = ['nw', 'ne', 'se', 'sw'];
const cornerKeys = ['n', 'e', 's', 'w'];
const cornerAdjacentSides = {
  n: ['nw', 'ne'],
  e: ['ne', 'se'],
  s: ['se', 'sw'],
  w: ['sw', 'nw'],
};

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let value = n;
    for (let k = 0; k < 8; k += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    table[n] = value >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let value = 0xffffffff;
  for (const byte of buffer) value = crcTable[(value ^ byte) & 255] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type, 'ascii');
  const output = Buffer.alloc(12 + data.length);
  output.writeUInt32BE(data.length, 0);
  typeBuffer.copy(output, 4);
  data.copy(output, 8);
  output.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 8 + data.length);
  return output;
}

function writePng(file, width, height, rgba) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0;
    Buffer.from(rgba.buffer, rgba.byteOffset + y * stride, stride).copy(raw, y * (stride + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  fs.writeFileSync(
    file,
    Buffer.concat([
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      pngChunk('IHDR', ihdr),
      pngChunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
      pngChunk('IEND', Buffer.alloc(0)),
    ])
  );
}

function readPng(file) {
  const buffer = fs.readFileSync(file);
  if (buffer.toString('ascii', 1, 4) !== 'PNG') throw new Error(`${file} is not a PNG`);
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  const chunks = [];
  let offset = 8;
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    if (type === 'IDAT') chunks.push(buffer.subarray(offset + 8, offset + 8 + length));
    offset += 12 + length;
  }
  const inflated = zlib.inflateSync(Buffer.concat(chunks));
  const stride = width * 4;
  const rgba = new Uint8Array(width * height * 4);
  let cursor = 0;
  let previous = Buffer.alloc(stride);
  for (let y = 0; y < height; y += 1) {
    const filter = inflated[cursor];
    cursor += 1;
    const raw = Buffer.from(inflated.subarray(cursor, cursor + stride));
    cursor += stride;
    const out = Buffer.alloc(stride);
    for (let x = 0; x < stride; x += 1) {
      const left = x >= 4 ? out[x - 4] : 0;
      const up = previous[x];
      const upLeft = x >= 4 ? previous[x - 4] : 0;
      if (filter === 0) out[x] = raw[x];
      else if (filter === 1) out[x] = (raw[x] + left) & 255;
      else if (filter === 2) out[x] = (raw[x] + up) & 255;
      else if (filter === 3) out[x] = (raw[x] + Math.floor((left + up) / 2)) & 255;
      else if (filter === 4) {
        const p = left + up - upLeft;
        const pa = Math.abs(p - left);
        const pb = Math.abs(p - up);
        const pc = Math.abs(p - upLeft);
        const predictor = pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft;
        out[x] = (raw[x] + predictor) & 255;
      } else {
        throw new Error(`unsupported PNG filter ${filter}`);
      }
    }
    rgba.set(out, y * stride);
    previous = out;
  }
  return { width, height, rgba };
}

function combinationKeys(keys, includeNone = false) {
  const combos = includeNone ? ['none'] : [];
  for (let mask = 1; mask < (1 << keys.length); mask += 1) {
    combos.push(keys.filter((_, index) => (mask & (1 << index)) !== 0).join('-'));
  }
  return combos;
}

function validCornerKeysForEdge(edgeKey) {
  const edgeSides = new Set(edgeKey === 'none' ? [] : edgeKey.split('-'));
  const validCorners = cornerKeys.filter((corner) => {
    const adjacent = cornerAdjacentSides[corner];
    return !(edgeSides.has(adjacent[0]) && edgeSides.has(adjacent[1]));
  });
  return combinationKeys(validCorners);
}

function getPixelBounds(image, predicate) {
  let minX = image.width;
  let minY = image.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const index = (y * image.width + x) * 4;
      if (!predicate(image.rgba, index)) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  return maxX >= minX ? { minX, minY, maxX, maxY } : null;
}

function isOpaque(data, index) {
  return data[index + 3] > 32;
}

function isTerrainTransparentInRiver(base, plains, index) {
  return plains.rgba[index + 3] > 32 && base.rgba[index + 3] <= 8;
}

function differsEnough(a, b, index) {
  return Math.abs(a.rgba[index] - b.rgba[index])
    + Math.abs(a.rgba[index + 1] - b.rgba[index + 1])
    + Math.abs(a.rgba[index + 2] - b.rgba[index + 2])
    + Math.abs(a.rgba[index + 3] - b.rgba[index + 3]) > 18;
}

function assertSameSize(a, b, label) {
  if (a.width !== b.width || a.height !== b.height) {
    throw new Error(`${label} size mismatch: ${a.width}x${a.height} vs ${b.width}x${b.height}`);
  }
}

function main() {
  fs.mkdirSync(outputDir, { recursive: true });
  const plains = readPng(path.join(tileMapDir, 'tile-terrain-plains.png'));
  const plainsBounds = getPixelBounds(plains, isOpaque);
  const edgeKeys = combinationKeys(sideKeys, true);
  const riverKeys = combinationKeys(sideKeys);
  let written = 0;

  for (const edgeKey of edgeKeys) {
    const edgeReference = edgeKey === 'none'
      ? plains
      : readPng(path.join(tileMapDir, 'coast-template', `tile-coast-template-${edgeKey}.png`));
    assertSameSize(edgeReference, plains, edgeKey);
    for (const cornerKey of validCornerKeysForEdge(edgeKey)) {
      const shape = readPng(path.join(tileMapDir, 'coast-shape-template', `tile-coast-shape-edge-${edgeKey}-corner-${cornerKey}.png`));
      assertSameSize(shape, plains, `${edgeKey}/${cornerKey}`);
      const shapeBounds = getPixelBounds(shape, isOpaque);
      if (JSON.stringify(shapeBounds) !== JSON.stringify(plainsBounds)) {
        throw new Error(`shape alpha bounds mismatch: ${edgeKey}/${cornerKey}`);
      }
      for (const riverKey of riverKeys) {
        const base = edgeKey === 'none'
          ? readPng(path.join(tileMapDir, 'river-template', `tile-river-bank-uv-${riverKey}.png`))
          : readPng(path.join(tileMapDir, 'coastal-river-template', `tile-coastal-river-coast-${edgeKey}-river-${riverKey}.png`));
        assertSameSize(base, plains, `${edgeKey}/${cornerKey}/${riverKey}`);
        const output = new Uint8Array(base.rgba);
        for (let index = 0; index < output.length; index += 4) {
          if (isTerrainTransparentInRiver(base, plains, index)) continue;
          if (!differsEnough(shape, edgeReference, index)) continue;
          output[index] = shape.rgba[index];
          output[index + 1] = shape.rgba[index + 1];
          output[index + 2] = shape.rgba[index + 2];
          output[index + 3] = shape.rgba[index + 3];
        }
        const key = `coast-${edgeKey}-corner-${cornerKey}-river-${riverKey}`;
        writePng(path.join(outputDir, `tile-coastal-river-shape-${key}.png`), base.width, base.height, output);
        written += 1;
      }
    }
  }
  process.stdout.write(`Generated ${written} coastal river shape templates in ${path.relative(projectRoot, outputDir)}\\n`);
}

main();
