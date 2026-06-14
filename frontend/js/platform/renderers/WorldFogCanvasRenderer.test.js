const test = require('node:test');
const assert = require('node:assert/strict');

const WorldFogCanvasRenderer = require('./WorldFogCanvasRenderer');

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

function createWorldContext() {
  return {
    tileMapView: {
      geometry: { tileWidth: 192, tileHeight: 96, stepX: 96, stepY: 48 },
      tiles: [
        { id: 'visible', q: 0, r: 0, discovered: true, visible: true, visibility: 'controlled' },
        { id: 'visible-east', q: 1, r: 0, discovered: true, visible: true, visibility: 'scouted' },
        { id: 'explored', q: 2, r: 0, discovered: true, visible: false, visibility: 'scouted' },
        { id: 'unknown', q: 3, r: 0, discovered: false, visible: false, visibility: 'unknown' },
      ],
    },
    viewport: { originX: 130, originY: 120, panX: 0, panY: 0, scale: 0.5 },
    frame: { x: 10, y: 20, width: 300, height: 240 },
    entries: [
      {
        tile: { id: 'visible', q: 0, r: 0, discovered: true, visible: true, visibility: 'controlled' },
        center: { x: 130, y: 120 },
        drawRect: { x: 82, y: 96, width: 96, height: 48 },
      },
      {
        tile: { id: 'visible-east', q: 1, r: 0, discovered: true, visible: true, visibility: 'scouted' },
        center: { x: 178, y: 144 },
        drawRect: { x: 130, y: 120, width: 96, height: 48 },
      },
      {
        tile: { id: 'explored', q: 2, r: 0, discovered: true, visible: false, visibility: 'scouted' },
        center: { x: 226, y: 168 },
        drawRect: { x: 178, y: 144, width: 96, height: 48 },
      },
      {
        tile: { id: 'unknown', q: 3, r: 0, discovered: false, visible: false, visibility: 'unknown' },
        center: { x: 274, y: 192 },
        drawRect: { x: 226, y: 168, width: 96, height: 48 },
      },
    ],
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

test('WorldFogCanvasRenderer writes explored and visible masks separately', () => {
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

  const { mask } = renderer.prepareMaskFromEntries(
    context.tileMapView,
    context.entries,
    context.viewport,
    context.frame,
    context.tileMapView.geometry,
  );

  const exploredCount = mask.explored.reduce((count, value) => count + (value > 0 ? 1 : 0), 0);
  const visibleCount = mask.visible.reduce((count, value) => count + (value > 0 ? 1 : 0), 0);
  const hasSoftAlpha = mask.explored.some((value) => value > 0 && value < 255);
  assert.equal(exploredCount > visibleCount, true);
  assert.equal(visibleCount > 0, true);
  assert.equal(hasSoftAlpha, true);
  assert.equal(renderer.isExploredTile({ discovered: true, visible: false, visibility: 'scouted' }), true);
  assert.equal(renderer.isVisibleTile({ discovered: true, visible: false, visibility: 'scouted' }), false);
  assert.equal(renderer.isVisibleTile({ discovered: true, visible: true, visibility: 'scouted' }), true);
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

test('WorldFogCanvasRenderer reuses mask texture during small camera pans', () => {
  const calls = [];
  const gl = createFakeGl(calls);
  const renderer = new WorldFogCanvasRenderer({
    gl,
    canvas: createCanvas(gl),
    pixelRatio: 1,
    width: 390,
    height: 844,
    maskSize: 128,
    maskPanReuseLimit: 80,
  });
  const context = createWorldContext();
  const panDelta = { x: 32, y: -18 };
  const pannedContext = {
    ...context,
    viewport: {
      ...context.viewport,
      panX: context.viewport.panX + panDelta.x,
      panY: context.viewport.panY + panDelta.y,
    },
    entries: context.entries.map((entry) => ({
      ...entry,
      center: {
        x: entry.center.x + panDelta.x,
        y: entry.center.y + panDelta.y,
      },
      drawRect: {
        ...entry.drawRect,
        x: entry.drawRect.x + panDelta.x,
        y: entry.drawRect.y + panDelta.y,
      },
    })),
  };

  assert.equal(renderer.renderWorldFog(context), true);
  assert.equal(renderer.renderWorldFog(pannedContext), true);

  assert.equal(calls.filter((call) => call[0] === 'texImage2D').length, 2);
  assert.equal(calls.some((call) => call[0] === 'uniform2f' && call[1] === 'uMaskOffset' && call[2] === panDelta.x && call[3] === panDelta.y), true);
});

test('WorldFogCanvasRenderer derives fog cache identity from stable coordinates', () => {
  const renderer = new WorldFogCanvasRenderer({ width: 390, height: 844, maskSize: 128 });
  const viewport = { originX: 130, originY: 120, panX: 0, panY: 0, scale: 0.5 };
  const geometry = { tileWidth: 192, tileHeight: 96, stepX: 96, stepY: 48, anchorY: 0.5 };
  const frame = { x: 10, y: 20, width: 300, height: 240 };
  const dimensions = { width: 128, height: 128 };
  const stableTile = {
    id: 'legacy-a',
    tileId: 'legacy-tile-a',
    x: 4,
    y: -2,
    q: 99,
    r: 99,
    discovered: true,
    visible: true,
    visibility: 'scouted',
  };
  const legacyShapeTile = {
    id: 'legacy-b',
    tileId: 'legacy-tile-b',
    q: 4,
    r: -2,
    discovered: true,
    visible: true,
    visibility: 'scouted',
  };
  const stableEntry = renderer.normalizeEntry(stableTile, viewport, geometry);
  const legacyEntry = renderer.normalizeEntry(legacyShapeTile, viewport, geometry);

  assert.equal(renderer.getTileKey(stableTile), renderer.getTileKey(legacyShapeTile));
  assert.deepEqual(stableEntry.center, legacyEntry.center);
  assert.deepEqual(stableEntry.drawRect, legacyEntry.drawRect);
  assert.equal(
    renderer.getMaskCacheKey({}, [stableEntry], viewport, frame, geometry, dimensions),
    renderer.getMaskCacheKey({}, [legacyEntry], viewport, frame, geometry, dimensions),
  );
});

test('WorldFogCanvasRenderer builds a continuous visible-region mask across neighboring tiles', () => {
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
  const { mask } = renderer.prepareMaskFromEntries(
    context.tileMapView,
    context.entries,
    context.viewport,
    context.frame,
    context.tileMapView.geometry,
  );
  const maskFrame = mask.maskFrame || context.frame;
  const scaleX = mask.width / maskFrame.width;
  const scaleY = mask.height / maskFrame.height;
  const seamX = Math.round((154 - maskFrame.x) * scaleX);
  const seamY = Math.round((132 - maskFrame.y) * scaleY);
  const seamValue = mask.visible[seamY * mask.width + seamX];

  assert.equal(seamValue >= 240, true);
});

test('WorldFogCanvasRenderer shader samples masks inside the map frame', () => {
  const source = WorldFogCanvasRenderer.FRAGMENT_SHADER_SOURCE;

  assert.match(source, /sampler2D uExploredMask/);
  assert.match(source, /sampler2D uVisibleMask/);
  assert.match(source, /uMaskFrame/);
  assert.match(source, /uMaskOffset/);
  assert.match(source, /maskUv = \(pixel - uMaskFrame\.xy - uMaskOffset\)/);
  assert.match(source, /visible -> transparent|visibleAlpha/s);
  assert.equal(source.includes('texture2D(uExploredMask, vUv)'), false);
  assert.equal(source.includes('stroke'), false);
});
