const test = require('node:test');
const assert = require('node:assert/strict');

const WorldFogCanvasRenderer = require('./WorldFogCanvasRenderer');
const WorldFogMaskGenerator = require('./WorldFogMaskGenerator');

function createFakeGl(calls = []) {
  let shaderId = 0;
  let programId = 0;
  let textureId = 0;
  return {
    VERTEX_SHADER: 0x8b31,
    FRAGMENT_SHADER: 0x8b30,
    COMPILE_STATUS: 0x8b81,
    LINK_STATUS: 0x8b82,
    ARRAY_BUFFER: 0x8892,
    STATIC_DRAW: 0x88e4,
    FLOAT: 0x1406,
    TRIANGLES: 0x0004,
    TEXTURE_2D: 0x0de1,
    TEXTURE0: 0x84c0,
    LUMINANCE: 0x1909,
    UNSIGNED_BYTE: 0x1401,
    TEXTURE_MIN_FILTER: 0x2801,
    TEXTURE_MAG_FILTER: 0x2800,
    TEXTURE_WRAP_S: 0x2802,
    TEXTURE_WRAP_T: 0x2803,
    LINEAR: 0x2601,
    CLAMP_TO_EDGE: 0x812f,
    COLOR_BUFFER_BIT: 0x4000,
    DEPTH_TEST: 0x0b71,
    CULL_FACE: 0x0b44,
    BLEND: 0x0be2,
    SRC_ALPHA: 0x0302,
    ONE_MINUS_SRC_ALPHA: 0x0303,
    UNPACK_ALIGNMENT: 0x0cf5,
    drawingBufferWidth: 390,
    drawingBufferHeight: 844,
    createShader(type) {
      const shader = { id: `shader-${++shaderId}`, type };
      calls.push(['createShader', type, shader.id]);
      return shader;
    },
    shaderSource(shader, source) {
      shader.source = source;
      calls.push(['shaderSource', shader.id, source]);
    },
    compileShader(shader) {
      calls.push(['compileShader', shader.id]);
    },
    getShaderParameter() {
      return true;
    },
    getShaderInfoLog() {
      return '';
    },
    deleteShader(shader) {
      calls.push(['deleteShader', shader.id]);
    },
    createProgram() {
      const program = { id: `program-${++programId}` };
      calls.push(['createProgram', program.id]);
      return program;
    },
    attachShader(program, shader) {
      calls.push(['attachShader', program.id, shader.id]);
    },
    linkProgram(program) {
      calls.push(['linkProgram', program.id]);
    },
    getProgramParameter() {
      return true;
    },
    getProgramInfoLog() {
      return '';
    },
    deleteProgram(program) {
      calls.push(['deleteProgram', program.id]);
    },
    createBuffer() {
      const buffer = { id: 'buffer-1' };
      calls.push(['createBuffer', buffer.id]);
      return buffer;
    },
    bindBuffer(...args) {
      calls.push(['bindBuffer', ...args]);
    },
    bufferData(target, data, usage) {
      calls.push(['bufferData', target, data.length, usage]);
    },
    createTexture() {
      const texture = { id: `texture-${++textureId}` };
      calls.push(['createTexture', texture.id]);
      return texture;
    },
    bindTexture(target, texture) {
      calls.push(['bindTexture', target, texture?.id || null]);
    },
    texParameteri(...args) {
      calls.push(['texParameteri', ...args]);
    },
    getAttribLocation(program, name) {
      calls.push(['getAttribLocation', program.id, name]);
      return 0;
    },
    getUniformLocation(program, name) {
      const location = { name };
      calls.push(['getUniformLocation', program.id, name]);
      return location;
    },
    viewport(...args) {
      calls.push(['viewport', ...args]);
    },
    disable(...args) {
      calls.push(['disable', ...args]);
    },
    enable(...args) {
      calls.push(['enable', ...args]);
    },
    blendFunc(...args) {
      calls.push(['blendFunc', ...args]);
    },
    clearColor(...args) {
      calls.push(['clearColor', ...args]);
    },
    clear(...args) {
      calls.push(['clear', ...args]);
    },
    useProgram(program) {
      calls.push(['useProgram', program.id]);
    },
    enableVertexAttribArray(...args) {
      calls.push(['enableVertexAttribArray', ...args]);
    },
    vertexAttribPointer(...args) {
      calls.push(['vertexAttribPointer', ...args]);
    },
    uniform1i(location, value) {
      calls.push(['uniform1i', location.name, value]);
    },
    uniform2f(location, x, y) {
      calls.push(['uniform2f', location.name, x, y]);
    },
    uniform4f(location, x, y, width, height) {
      calls.push(['uniform4f', location.name, x, y, width, height]);
    },
    uniform1f(location, value) {
      calls.push(['uniform1f', location.name, value]);
    },
    activeTexture(textureUnit) {
      calls.push(['activeTexture', textureUnit]);
    },
    pixelStorei(...args) {
      calls.push(['pixelStorei', ...args]);
    },
    texImage2D(target, level, internalFormat, width, height, border, format, type, pixels) {
      calls.push(['texImage2D', target, level, internalFormat, width, height, border, format, type, pixels?.length || 0]);
    },
    drawArrays(...args) {
      calls.push(['drawArrays', ...args]);
    },
  };
}

function createCanvas(gl) {
  return {
    width: 390,
    height: 844,
    getContext(type) {
      return type === 'webgl' || type === 'experimental-webgl' ? gl : null;
    },
  };
}

function createWorldContext(overrides = {}) {
  const tileMapView = {
    geometry: { tileWidth: 192, tileHeight: 96, stepX: 96, stepY: 48, anchorY: 0.5 },
    tiles: [
      { id: 'capital-tile', q: 0, r: 0, discovered: true, visible: true, visibility: 'controlled', siteId: 'capital', terrain: 'capital' },
      { id: 'memory-tile', q: 2, r: 0, discovered: true, visible: false, visibility: 'scouted' },
      { id: 'unknown-tile', q: 4, r: 0, discovered: false, visible: false, visibility: 'unknown' },
    ],
    sites: [
      { id: 'capital', q: 0, r: 0, type: 'capital', owner: 'player', cityName: 'Capital' },
    ],
  };
  const viewport = { originX: 130, originY: 120, panX: 0, panY: 0, scale: 0.5 };
  const frame = { x: 10, y: 20, width: 300, height: 240 };
  return {
    tileMapView,
    viewport,
    frame,
    entries: [
      {
        tile: tileMapView.tiles[0],
        center: { x: 130, y: 120 },
        drawRect: { x: 82, y: 96, width: 96, height: 48 },
      },
      {
        tile: tileMapView.tiles[1],
        center: { x: 226, y: 168 },
        drawRect: { x: 178, y: 144, width: 96, height: 48 },
      },
      {
        tile: tileMapView.tiles[2],
        center: { x: 322, y: 216 },
        drawRect: { x: 274, y: 192, width: 96, height: 48 },
      },
    ],
    actors: [
      { id: 'unit-1', status: 'active', current: { q: 1, r: 0 } },
    ],
    ...overrides,
  };
}

test('WorldFogCanvasRenderer renders fog through WebGL mask textures', () => {
  const calls = [];
  const gl = createFakeGl(calls);
  const renderer = new WorldFogCanvasRenderer({
    gl,
    canvas: createCanvas(gl),
    pixelRatio: 1,
    width: 390,
    height: 844,
    maskSize: 128,
  });

  const rendered = renderer.renderWorldFog(createWorldContext());

  assert.equal(rendered, true);
  assert.equal(calls.some((call) => call[0] === 'createProgram'), true);
  assert.equal(calls.filter((call) => call[0] === 'createTexture').length, 2);
  assert.equal(calls.filter((call) => call[0] === 'texImage2D').length, 2);
  assert.equal(calls.some((call) => call[0] === 'uniform1i' && call[1] === 'uExploredMask' && call[2] === 0), true);
  assert.equal(calls.some((call) => call[0] === 'uniform1i' && call[1] === 'uVisibleMask' && call[2] === 1), true);
  assert.equal(calls.some((call) => call[0] === 'drawArrays' && call[1] === gl.TRIANGLES && call[3] === 6), true);
});

test('WorldFogCanvasRenderer keeps rendering concerns separate from mask generation', () => {
  const gl = createFakeGl([]);
  const maskGenerator = {
    calls: [],
    prepare(context) {
      this.calls.push(context);
      return {
        changed: true,
        mask: {
          key: 'external-mask',
          width: 2,
          height: 2,
          explored: new Uint8Array([255, 255, 0, 0]),
          visible: new Uint8Array([255, 64, 0, 0]),
          maskFrame: context.frame,
        },
      };
    },
  };
  const renderer = new WorldFogCanvasRenderer({
    gl,
    canvas: createCanvas(gl),
    maskGenerator,
  });

  assert.equal(renderer.renderWorldFog(createWorldContext()), true);
  assert.equal(maskGenerator.calls.length, 1);
  assert.equal(typeof renderer.prepareMaskFromEntries, 'undefined');
  assert.equal(typeof renderer.rasterizeHardDiamond, 'undefined');
  assert.equal(typeof renderer.isVisibleTile, 'undefined');
});

test('WorldFogCanvasRenderer caches mask uploads across animated redraws', () => {
  const calls = [];
  const gl = createFakeGl(calls);
  const renderer = new WorldFogCanvasRenderer({
    gl,
    canvas: createCanvas(gl),
    pixelRatio: 1,
    width: 390,
    height: 844,
    maskSize: 128,
  });
  const context = createWorldContext();

  assert.equal(renderer.renderWorldFog(context), true);
  assert.equal(calls.filter((call) => call[0] === 'texImage2D').length, 2);
  assert.equal(renderer.renderWorldFog(context), true);

  assert.equal(calls.filter((call) => call[0] === 'texImage2D').length, 2);
  assert.equal(calls.filter((call) => call[0] === 'drawArrays').length, 2);
});

test('WorldFogCanvasRenderer shader samples soft masks inside the map frame', () => {
  const source = WorldFogCanvasRenderer.FRAGMENT_SHADER_SOURCE;

  assert.match(source, /sampler2D uExploredMask/);
  assert.match(source, /sampler2D uVisibleMask/);
  assert.match(source, /uMaskFrame/);
  assert.match(source, /maskUv = \(pixel - uMaskFrame\.xy\)/);
  assert.match(source, /vec3 unknownColor = vec3\(0\.0, 0\.0, 0\.0\)/);
  assert.equal(source.includes('uMaskOffset'), false);
  assert.equal(source.includes('uFeather'), false);
  assert.equal(source.includes('stroke'), false);
});

test('WorldFogMaskGenerator produces center-clear and ring-falloff unit vision', () => {
  const generator = new WorldFogMaskGenerator({ maskSize: 128 });
  const context = createWorldContext({
    tileMapView: {
      geometry: { tileWidth: 192, tileHeight: 96, stepX: 96, stepY: 48, anchorY: 0.5 },
      tiles: [{ id: 'origin', q: 1, r: 0, discovered: true, visible: true, visibility: 'visible' }],
      sites: [],
    },
    entries: [
      { tile: { id: 'origin', q: 1, r: 0, discovered: true, visible: true, visibility: 'visible' }, center: { x: 178, y: 144 } },
    ],
    actors: [{ id: 'unit-1', current: { q: 1, r: 0 }, status: 'active' }],
  });

  const { mask } = generator.prepare(context);
  const center = readMaskAt(mask.visible, mask, { x: 178, y: 144 });
  const ring = readMaskAt(mask.visible, mask, { x: 226, y: 168 });
  const outside = readMaskAt(mask.visible, mask, { x: 274, y: 192 });

  assert.equal(center >= 245, true);
  assert.equal(ring > 35 && ring < 220, true);
  assert.equal(outside < ring, true);
});

test('WorldFogMaskGenerator gives cities a larger soft vision radius than units', () => {
  const generator = new WorldFogMaskGenerator({ maskSize: 128 });
  const context = createWorldContext({
    actors: [],
  });

  const { mask, sourceSet } = generator.prepare(context);
  const center = readMaskAt(mask.visible, mask, { x: 130, y: 120 });
  const radiusTwo = readMaskAt(mask.visible, mask, { x: 226, y: 168 });
  const outside = readMaskAt(mask.visible, mask, { x: 274, y: 192 });

  assert.equal(sourceSet.citySources.length, 1);
  assert.equal(center >= 245, true);
  assert.equal(radiusTwo > 35 && radiusTwo < center, true);
  assert.equal(outside < radiusTwo, true);
});

test('WorldFogMaskGenerator treats player subcities as city vision sources', () => {
  const generator = new WorldFogMaskGenerator({ maskSize: 128 });
  const context = createWorldContext({
    tileMapView: {
      geometry: { tileWidth: 192, tileHeight: 96, stepX: 96, stepY: 48, anchorY: 0.5 },
      tiles: [{ id: 'frontier', q: 1, r: 0, discovered: true, visible: true, visibility: 'controlled', siteId: 'frontier' }],
      sites: [{ id: 'frontier', q: 1, r: 0, type: 'town', owner: 'player', status: 'occupied', cityName: 'Frontier' }],
    },
    entries: [
      { tile: { id: 'frontier', q: 1, r: 0, discovered: true, visible: true, visibility: 'controlled', siteId: 'frontier' }, center: { x: 178, y: 144 } },
    ],
    actors: [],
  });

  const { mask, sourceSet } = generator.prepare(context);
  const center = readMaskAt(mask.visible, mask, { x: 178, y: 144 });
  const radiusTwo = readMaskAt(mask.visible, mask, { x: 274, y: 192 });

  assert.equal(sourceSet.citySources.length, 1);
  assert.equal(center >= 245, true);
  assert.equal(radiusTwo > 35 && radiusTwo < center, true);
});

test('WorldFogMaskGenerator does not grant current vision from non-player cities', () => {
  const generator = new WorldFogMaskGenerator({ maskSize: 128 });
  const context = createWorldContext({
    tileMapView: {
      geometry: { tileWidth: 192, tileHeight: 96, stepX: 96, stepY: 48, anchorY: 0.5 },
      tiles: [{ id: 'neutral-town', q: 0, r: 0, discovered: true, visible: false, visibility: 'scouted', siteId: 'neutral-town' }],
      sites: [{ id: 'neutral-town', q: 0, r: 0, type: 'town', owner: 'neutral', status: 'discovered', cityName: 'Neutral Town' }],
    },
    entries: [
      { tile: { id: 'neutral-town', q: 0, r: 0, discovered: true, visible: false, visibility: 'scouted', siteId: 'neutral-town' }, center: { x: 130, y: 120 } },
    ],
    actors: [],
  });

  const { mask, sourceSet } = generator.prepare(context);
  const explored = readMaskAt(mask.explored, mask, { x: 130, y: 120 });
  const visible = readMaskAt(mask.visible, mask, { x: 130, y: 120 });

  assert.equal(sourceSet.citySources.length, 0);
  assert.equal(explored >= 245, true);
  assert.equal(visible, 0);
});

test('WorldFogMaskGenerator separates explored memory from current visibility', () => {
  const generator = new WorldFogMaskGenerator({ maskSize: 128 });
  const context = createWorldContext({
    tileMapView: {
      geometry: { tileWidth: 192, tileHeight: 96, stepX: 96, stepY: 48, anchorY: 0.5 },
      tiles: [{ id: 'memory', q: 2, r: 0, discovered: true, visible: false, visibility: 'scouted' }],
      sites: [],
    },
    entries: [
      { tile: { id: 'memory', q: 2, r: 0, discovered: true, visible: false, visibility: 'scouted' }, center: { x: 226, y: 168 } },
    ],
    actors: [],
  });

  const { mask } = generator.prepare(context);
  const explored = readMaskAt(mask.explored, mask, { x: 226, y: 168 });
  const visible = readMaskAt(mask.visible, mask, { x: 226, y: 168 });
  const unknown = readMaskAt(mask.explored, mask, { x: 322, y: 216 });

  assert.equal(explored >= 245, true);
  assert.equal(visible, 0);
  assert.equal(unknown, 0);
});

function readMaskAt(channel, mask, point) {
  const frame = mask.maskFrame;
  const x = Math.max(0, Math.min(mask.width - 1, Math.round(((point.x - frame.x) / frame.width) * mask.width)));
  const y = Math.max(0, Math.min(mask.height - 1, Math.round(((point.y - frame.y) / frame.height) * mask.height)));
  return channel[y * mask.width + x];
}
