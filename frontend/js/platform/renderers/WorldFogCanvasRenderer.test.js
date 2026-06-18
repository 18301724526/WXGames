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

test('WorldFogCanvasRenderer covers the world viewport instead of only the map render frame', () => {
  const calls = [];
  const gl = createFakeGl(calls);
  const renderer = new WorldFogCanvasRenderer({
    gl,
    canvas: createCanvas(gl),
    pixelRatio: 1,
    width: 520,
    height: 760,
    viewportOffsetX: 40,
    viewportOffsetY: 50,
    viewportWidth: 390,
    viewportHeight: 640,
    maskSize: 128,
  });

  assert.equal(renderer.renderWorldFog(createWorldContext({
    frame: { x: 82, y: 120, width: 260, height: 220 },
  })), true);

  const frameUniform = calls.find((call) => call[0] === 'uniform4f' && call[1] === 'uFrame');
  assert.deepEqual(frameUniform?.slice(2), [40, 50, 390, 640]);
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
  assert.match(source, /rawMaskUv = \(pixel - uMaskFrame\.xy\)/);
  assert.match(source, /float maskInside = step\(0\.0, rawMaskUv\.x\)/);
  assert.match(source, /texture2D\(uExploredMask, maskUv\)\.r \* maskInside/);
  assert.match(source, /coverEdge \*= smoothstep/);
  assert.match(source, /vec3 unknownColor = vec3\(0\.0, 0\.0, 0\.0\)/);
  assert.equal(source.includes('uMaskOffset'), false);
  assert.equal(source.includes('uFeather'), false);
  assert.equal(source.includes('stroke'), false);
});

test('WorldFogMaskGenerator keeps visible softness inside the visible tile boundary', () => {
  const generator = new WorldFogMaskGenerator({ maskSize: 128 });
  const context = createWorldContext({
    tileMapView: {
      geometry: { tileWidth: 192, tileHeight: 96, stepX: 96, stepY: 48, anchorY: 0.5 },
      tiles: [
        { id: 'origin', q: 1, r: 0, discovered: true, visible: true, visibility: 'visible' },
        { id: 'unknown-neighbor', q: 2, r: 0, discovered: false, visible: false, visibility: 'unknown' },
      ],
      sites: [],
    },
    entries: [
      { tile: { id: 'origin', q: 1, r: 0, discovered: true, visible: true, visibility: 'visible' }, center: { x: 178, y: 144 } },
      { tile: { id: 'unknown-neighbor', q: 2, r: 0, discovered: false, visible: false, visibility: 'unknown' }, center: { x: 226, y: 168 } },
    ],
    actors: [{ id: 'unit-1', current: { q: 1, r: 0 }, status: 'active' }],
  });

  const { mask } = generator.prepare(context);
  const center = readMaskAt(mask.visible, mask, { x: 178, y: 144 });
  const insideEdge = readMaskAt(mask.visible, mask, { x: 190, y: 150 });
  const unknownNeighborCenter = readMaskAt(mask.visible, mask, { x: 226, y: 168 });

  assert.equal(center >= 245, true);
  assert.equal(insideEdge > 0 && insideEdge < center, true);
  assert.equal(unknownNeighborCenter, 0);
});

test('WorldFogMaskGenerator gate: a single unlocked visible tile cannot reveal unknown neighbor pixels', () => {
  const generator = new WorldFogMaskGenerator({ maskSize: 128 });
  const context = createWorldContext({
    tileMapView: {
      geometry: { tileWidth: 192, tileHeight: 96, stepX: 96, stepY: 48, anchorY: 0.5 },
      tiles: [
        { id: 'tile_1_1', q: 1, r: 1, discovered: true, visible: true, visibility: 'visible' },
        { id: 'tile_1_2', q: 1, r: 2, discovered: false, visible: false, visibility: 'unknown' },
        { id: 'tile_1_3', q: 1, r: 3, discovered: false, visible: false, visibility: 'unknown' },
      ],
      sites: [],
    },
    entries: [
      { tile: { id: 'tile_1_1', q: 1, r: 1, discovered: true, visible: true, visibility: 'visible' }, center: { x: 130, y: 120 }, drawRect: { x: 82, y: 96, width: 96, height: 48 } },
      { tile: { id: 'tile_1_2', q: 1, r: 2, discovered: false, visible: false, visibility: 'unknown' }, center: { x: 82, y: 144 }, drawRect: { x: 34, y: 120, width: 96, height: 48 } },
      { tile: { id: 'tile_1_3', q: 1, r: 3, discovered: false, visible: false, visibility: 'unknown' }, center: { x: 34, y: 168 }, drawRect: { x: -14, y: 144, width: 96, height: 48 } },
    ],
    actors: [{ id: 'unit-1', current: { q: 1, r: 1 }, status: 'active' }],
  });

  const { mask } = generator.prepare(context);
  const unlockedVisible = readMaskAt(mask.visible, mask, { x: 130, y: 120 });
  const neighborExplored = readMaskAt(mask.explored, mask, { x: 82, y: 144 });
  const neighborVisible = readMaskAt(mask.visible, mask, { x: 82, y: 144 });
  const nextNeighborVisible = readMaskAt(mask.visible, mask, { x: 34, y: 168 });

  assert.equal(unlockedVisible >= 245, true);
  assert.equal(neighborExplored, 0);
  assert.equal(neighborVisible, 0);
  assert.equal(nextNeighborVisible, 0);
});

test('WorldFogMaskGenerator does not feather explored mask into unknown tiles', () => {
  const generator = new WorldFogMaskGenerator({ maskSize: 128 });
  const context = createWorldContext({
    tileMapView: {
      geometry: { tileWidth: 192, tileHeight: 96, stepX: 96, stepY: 48, anchorY: 0.5 },
      tiles: [
        { id: 'memory', q: 0, r: 0, discovered: true, visible: false, visibility: 'scouted' },
        { id: 'unknown', q: 1, r: 0, discovered: false, visible: false, visibility: 'unknown' },
      ],
      sites: [],
    },
    entries: [
      { tile: { id: 'memory', q: 0, r: 0, discovered: true, visible: false, visibility: 'scouted' }, center: { x: 130, y: 120 } },
      { tile: { id: 'unknown', q: 1, r: 0, discovered: false, visible: false, visibility: 'unknown' }, center: { x: 178, y: 144 } },
    ],
    actors: [],
  });

  const { mask, sourceSet } = generator.prepare(context);
  const center = readMaskAt(mask.visible, mask, { x: 130, y: 120 });
  const exploredCenter = readMaskAt(mask.explored, mask, { x: 130, y: 120 });
  const unknownExplored = readMaskAt(mask.explored, mask, { x: 178, y: 144 });
  const unknownVisible = readMaskAt(mask.visible, mask, { x: 178, y: 144 });

  assert.equal(sourceSet.memorySources.length, 1);
  assert.equal(exploredCenter >= 245, true);
  assert.equal(center, 0);
  assert.equal(unknownExplored, 0);
  assert.equal(unknownVisible, 0);
});

test('WorldFogMaskGenerator keeps explored memory out of current visibility even when sources are nearby', () => {
  const generator = new WorldFogMaskGenerator({ maskSize: 128 });
  const context = createWorldContext({
    tileMapView: {
      geometry: { tileWidth: 192, tileHeight: 96, stepX: 96, stepY: 48, anchorY: 0.5 },
      tiles: [
        { id: 'visible-origin', q: 0, r: 0, discovered: true, visible: true, visibility: 'controlled', siteId: 'capital' },
        { id: 'memory-neighbor', q: 1, r: 0, discovered: true, visible: false, visibility: 'scouted' },
      ],
      sites: [{ id: 'capital', q: 0, r: 0, type: 'capital', owner: 'player', cityName: 'Capital' }],
    },
    entries: [
      { tile: { id: 'visible-origin', q: 0, r: 0, discovered: true, visible: true, visibility: 'controlled', siteId: 'capital' }, center: { x: 130, y: 120 } },
      { tile: { id: 'memory-neighbor', q: 1, r: 0, discovered: true, visible: false, visibility: 'scouted' }, center: { x: 178, y: 144 } },
    ],
    actors: [{ id: 'unit-1', current: { q: 0, r: 0 }, status: 'active' }],
  });

  const { mask, sourceSet } = generator.prepare(context);
  const memoryExplored = readMaskAt(mask.explored, mask, { x: 178, y: 144 });
  const memoryVisible = readMaskAt(mask.visible, mask, { x: 178, y: 144 });

  assert.equal(sourceSet.citySources.length, 1);
  assert.equal(sourceSet.unitSources.length, 1);
  assert.equal(memoryExplored >= 245, true);
  assert.equal(memoryVisible, 0);
});

test('WorldFogMaskGenerator ignores terrain draw overdraw when clipping fog masks', () => {
  const generator = new WorldFogMaskGenerator({ maskSize: 128 });
  const context = createWorldContext({
    tileMapView: {
      geometry: { tileWidth: 192, tileHeight: 96, stepX: 96, stepY: 48, anchorY: 0.5 },
      tiles: [{ id: 'visible-origin', q: 0, r: 0, discovered: true, visible: true, visibility: 'visible' }],
      sites: [],
    },
    entries: [
      {
        tile: { id: 'visible-origin', q: 0, r: 0, discovered: true, visible: true, visibility: 'visible' },
        center: { x: 130, y: 120 },
        drawRect: { x: 58, y: 72, width: 144, height: 96 },
      },
    ],
    actors: [],
  });

  const { mask } = generator.prepare(context);
  const center = readMaskAt(mask.visible, mask, { x: 130, y: 120 });
  const drawOverhang = readMaskAt(mask.visible, mask, { x: 185, y: 120 });

  assert.equal(center >= 245, true);
  assert.equal(drawOverhang, 0);
});

test('WorldFogMaskGenerator treats player subcities as tile-bounded city vision sources', () => {
  const generator = new WorldFogMaskGenerator({ maskSize: 128 });
  const context = createWorldContext({
    tileMapView: {
      geometry: { tileWidth: 192, tileHeight: 96, stepX: 96, stepY: 48, anchorY: 0.5 },
      tiles: [
        { id: 'frontier', q: 1, r: 0, discovered: true, visible: true, visibility: 'controlled', siteId: 'frontier' },
        { id: 'unknown-next', q: 2, r: 0, discovered: false, visible: false, visibility: 'unknown' },
      ],
      sites: [{ id: 'frontier', q: 1, r: 0, type: 'town', owner: 'player', status: 'occupied', cityName: 'Frontier' }],
    },
    entries: [
      { tile: { id: 'frontier', q: 1, r: 0, discovered: true, visible: true, visibility: 'controlled', siteId: 'frontier' }, center: { x: 178, y: 144 } },
      { tile: { id: 'unknown-next', q: 2, r: 0, discovered: false, visible: false, visibility: 'unknown' }, center: { x: 226, y: 168 } },
    ],
    actors: [],
  });

  const { mask, sourceSet } = generator.prepare(context);
  const center = readMaskAt(mask.visible, mask, { x: 178, y: 144 });
  const unknownNext = readMaskAt(mask.visible, mask, { x: 226, y: 168 });

  assert.equal(sourceSet.citySources.length, 1);
  assert.equal(center >= 245, true);
  assert.equal(unknownNext, 0);
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
  assert.equal(unknown < explored * 0.08, true);
});

test('WorldFogMaskGenerator pads the mask frame so soft sources are not cut by frame edges', () => {
  const generator = new WorldFogMaskGenerator({ maskSize: 128 });
  const context = createWorldContext({
    frame: { x: 40, y: 60, width: 180, height: 140 },
  });

  const { mask } = generator.prepare(context);

  assert.equal(mask.maskFrame.x < context.frame.x, true);
  assert.equal(mask.maskFrame.y < context.frame.y, true);
  assert.equal(mask.maskFrame.width > context.frame.width, true);
  assert.equal(mask.maskFrame.height > context.frame.height, true);
});

test('WorldFogMaskGenerator includes the full fog cover viewport in its mask frame', () => {
  const generator = new WorldFogMaskGenerator({ maskSize: 128 });
  const context = createWorldContext({
    frame: { x: 82, y: 120, width: 260, height: 220 },
    coverFrame: { x: 40, y: 50, width: 390, height: 640 },
  });

  const { mask } = generator.prepare(context);

  assert.equal(mask.maskFrame.x < context.coverFrame.x, true);
  assert.equal(mask.maskFrame.y < context.coverFrame.y, true);
  assert.equal(mask.maskFrame.x + mask.maskFrame.width > context.coverFrame.x + context.coverFrame.width, true);
  assert.equal(mask.maskFrame.y + mask.maskFrame.height > context.coverFrame.y + context.coverFrame.height, true);
});

test('WorldFogMaskGenerator trusts tile visibility as current clear mask authority', () => {
  const generator = new WorldFogMaskGenerator({ maskSize: 128 });
  const context = createWorldContext({
    tileMapView: {
      geometry: { tileWidth: 192, tileHeight: 96, stepX: 96, stepY: 48, anchorY: 0.5 },
      tiles: [{ id: 'visible-fallback', q: 0, r: 0, discovered: true, visible: true, visibility: 'visible' }],
      sites: [],
    },
    entries: [
      { tile: { id: 'visible-fallback', q: 0, r: 0, discovered: true, visible: true, visibility: 'visible' }, center: { x: 130, y: 120 } },
    ],
    actors: [],
  });

  const { mask, sourceSet } = generator.prepare(context);
  const explored = readMaskAt(mask.explored, mask, { x: 130, y: 120 });
  const visible = readMaskAt(mask.visible, mask, { x: 130, y: 120 });

  assert.equal(sourceSet.visibleTileSources.length, 1);
  assert.equal(sourceSet.visionSources.length, 0);
  assert.equal(explored >= 245, true);
  assert.equal(visible >= 245, true);
});

test('WorldFogMaskGenerator rasterizes tile-local masks without outward source stamps', () => {
  const generator = new WorldFogMaskGenerator({ maskSize: 128 });

  assert.equal(typeof generator.evaluateSources, 'undefined');
  assert.equal(typeof generator.evaluateSource, 'undefined');
  assert.equal(typeof generator.stampSource, 'undefined');
  assert.equal(typeof generator.softBlurChannel, 'undefined');
  assert.equal(typeof generator.rasterizeTileMask, 'function');
});

test('WorldFogMaskGenerator thins interior memory sources while preserving explored boundaries', () => {
  const tiles = [];
  const entries = [];
  for (let q = -8; q <= 8; q += 1) {
    for (let r = -8; r <= 8; r += 1) {
      const tile = { id: `tile_${q}_${r}`, q, r, discovered: true, visible: false, visibility: 'scouted' };
      tiles.push(tile);
      entries.push({
        tile,
        center: { x: 130 + (q - r) * 48, y: 120 + (q + r) * 24 },
      });
    }
  }
  const generator = new WorldFogMaskGenerator({ maskSize: 128 });
  const { sourceSet } = generator.prepare(createWorldContext({
    tileMapView: {
      geometry: { tileWidth: 192, tileHeight: 96, stepX: 96, stepY: 48, anchorY: 0.5 },
      tiles,
      sites: [],
    },
    entries,
    actors: [],
  }));

  assert.equal(entries.length, 289);
  assert.equal(sourceSet.memorySources.length < entries.length, true);
  assert.equal(sourceSet.memorySources.some((source) => source.q === -8 && source.r === -8), true);
});

function readMaskAt(channel, mask, point) {
  const frame = mask.maskFrame;
  const x = Math.max(0, Math.min(mask.width - 1, Math.round(((point.x - frame.x) / frame.width) * mask.width)));
  const y = Math.max(0, Math.min(mask.height - 1, Math.round(((point.y - frame.y) / frame.height) * mask.height)));
  return channel[y * mask.width + x];
}
