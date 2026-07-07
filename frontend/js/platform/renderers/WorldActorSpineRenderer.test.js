const test = require('node:test');
const assert = require('node:assert/strict');

require('../../config/UnitSpriteManifest');
const WorldActorSpineRenderer = require('./WorldActorSpineRenderer');

// A minimal spine 3.8 webgl runtime double: enough surface for the renderer to build a
// context, load a skeleton, drive one frame, and record animation/draw calls. It does no real
// GL work — the pixel output is verified live, this locks the decision + lifecycle logic.
function createFakeSpine(hooks = {}) {
  class Vector2 {
    constructor() { this.x = 0; this.y = 0; }
  }
  class Matrix4 {
    constructor() { this.values = new Array(16).fill(0); }
    ortho2d() { return this; }
  }
  // Real spine 3.8 exposes AssetManager under webgl (see SpineWebglPlayer.load).
  class AssetManager {
    constructor() { this.loaded = []; }
    loadText(file) { this.loaded.push(file); }
    loadTextureAtlas(file) { this.loaded.push(file); }
    isLoadingComplete() { return hooks.loadingComplete !== false; }
    get(file) { return { file }; }
  }
  class SkeletonJson {
    constructor() { this.scale = 1; }
    readSkeletonData(json) { return { json, animations: ['1', '2', '3', '4'] }; }
  }
  class Skeleton {
    constructor(data) { this.data = data; this.x = 0; this.y = 0; this.scaleX = 1; this.scaleY = 1; }
    setToSetupPose() {}
    updateWorldTransform() {}
    getBounds(offset, size) { size.x = 120; size.y = 200; }
  }
  class AnimationStateData {
    constructor() { this.defaultMix = 0; }
  }
  class AnimationState {
    constructor() { this.calls = []; }
    setAnimation(track, name, loop) { this.calls.push({ track, name, loop }); }
    update() {}
    apply() {}
  }
  return {
    Vector2,
    AtlasAttachmentLoader: class { constructor(atlas) { this.atlas = atlas; } },
    SkeletonJson,
    Skeleton,
    AnimationStateData,
    AnimationState,
    webgl: {
      // Real spine 3.8 exposes Matrix4 + AssetManager under the webgl namespace (SpineWebglPlayer).
      Matrix4,
      AssetManager,
      ManagedWebGLRenderingContext: class {
        constructor() {
          this.gl = {
            viewport() {},
            clearColor() {},
            clear() {},
            COLOR_BUFFER_BIT: 0x4000,
          };
        }
      },
      Shader: Object.assign(
        { SAMPLER: 0, MVP_MATRIX: 1 },
        {
          newTwoColoredTextured() {
            return { bind() {}, unbind() {}, setUniformi() {}, setUniform4x4f() {} };
          },
        },
      ),
      PolygonBatcher: class {
        begin() { if (hooks.batcherThrows) throw new Error('batcher boom'); }
        end() {}
      },
      SkeletonRenderer: class {
        constructor() { this.premultipliedAlpha = false; this.drawn = 0; }
        draw() { this.drawn += 1; }
      },
    },
  };
}

function createFakeHost(overrides = {}) {
  const events = { visible: [], present: [], cache: [], timeouts: [] };
  const runtime = {
    devicePixelRatio: 1,
    performance: { now: () => 0 },
    requestAnimationFrame: (cb) => { cb(); return 1; }, // synchronous: drives the asset pump
    setTimeout: (_cb, delayMs) => { events.timeouts.push(delayMs); return 2; },
    clearTimeout: () => {},
    cancelAnimationFrame: () => {},
    presentLayer: (name) => { events.present.push(name); return true; },
    refreshLayerPresentCache: (name) => { events.cache.push(name); return true; },
  };
  return {
    events,
    runtime,
    width: 390,
    height: 693,
    ensureCanvasLayer: overrides.ensureCanvasLayer || (() => ({ width: 0, height: 0 })),
    setCanvasLayerVisible: (name, visible) => { events.visible.push({ name, visible }); },
    requestOverlayRenderFrame: () => {},
    ...overrides,
  };
}

test('WorldActorSpineRenderer is unavailable and declines actors without a spine runtime', () => {
  const host = createFakeHost();
  const renderer = new WorldActorSpineRenderer({ host, runtime: host.runtime, spine: null });
  assert.equal(renderer.isAvailable(), false);
  assert.equal(renderer.canRenderActor({ unitKey: 'scout_squad_default' }), false);
});

test('WorldActorSpineRenderer declines actors whose unit has no spine descriptor', () => {
  const host = createFakeHost();
  const renderer = new WorldActorSpineRenderer({ host, runtime: host.runtime, spine: createFakeSpine() });
  assert.equal(renderer.isAvailable(), true);
  assert.equal(renderer.canRenderActor({ unitKey: 'no_such_unit' }), false);
});

test('WorldActorSpineRenderer loads the barbarian infantry skeleton then claims the actor', () => {
  const host = createFakeHost();
  const renderer = new WorldActorSpineRenderer({ host, runtime: host.runtime, spine: createFakeSpine() });

  // The (fake) asset load completes synchronously via the runtime rAF, so the actor is claimed.
  assert.equal(renderer.canRenderActor({ unitKey: 'scout_squad_default' }), true);
  assert.ok(renderer.skeletonAssets.barbarian_infantry?.skeletonData);
});

test('WorldActorSpineRenderer adds, retargets by facing, and removes actor skeletons', () => {
  const host = createFakeHost();
  const renderer = new WorldActorSpineRenderer({ host, runtime: host.runtime, spine: createFakeSpine() });
  renderer.canRenderActor({ unitKey: 'scout_squad_default' }); // warm the skeleton data

  renderer.syncActors([{ id: 'a1', unitKey: 'scout_squad_default', facing: '1', x: 40, y: 60, scale: 0.5 }]);
  const entry = renderer.actors.get('a1');
  assert.ok(entry);
  assert.equal(entry.animName, '1');
  assert.equal(entry.x, 40);
  assert.deepEqual(host.events.visible.at(-1), { name: 'worldActorSpine', visible: true });
  assert.deepEqual(host.events.timeouts, []);

  // Facing change re-targets the animation on the same skeleton (no rebuild).
  renderer.syncActors([{ id: 'a1', unitKey: 'scout_squad_default', facing: '2', x: 40, y: 60, scale: 0.5 }]);
  assert.equal(renderer.actors.get('a1').animName, '2');
  assert.equal(renderer.actors.size, 1);
  assert.deepEqual(host.events.timeouts, []);

  // Dropped from the frame list -> skeleton removed, layer hidden.
  renderer.syncActors([]);
  assert.equal(renderer.actors.size, 0);
  assert.deepEqual(host.events.visible.at(-1), { name: 'worldActorSpine', visible: false });
});

test('WorldActorSpineRenderer renders a frame and presents the stage layer', () => {
  const host = createFakeHost();
  const renderer = new WorldActorSpineRenderer({ host, runtime: host.runtime, spine: createFakeSpine() });
  renderer.canRenderActor({ unitKey: 'scout_squad_default' });
  renderer.syncActors([{ id: 'a1', unitKey: 'scout_squad_default', facing: '3', x: 40, y: 60, scale: 0.5 }]);

  host.events.present.length = 0;
  assert.equal(renderer.renderFrame(), true);

  assert.deepEqual(host.events.present, ['worldActorSpine']);
  assert.deepEqual(host.events.cache, []);
  const entry = renderer.actors.get('a1');
  assert.equal(entry.skeleton.x, 40);
  assert.equal(entry.skeleton.y, 693 - 60); // screen y-down -> spine y-up
});

test('WorldActorSpineRenderer falls back to cache refresh only on runtimes without presentLayer', () => {
  const host = createFakeHost();
  delete host.runtime.presentLayer;
  const renderer = new WorldActorSpineRenderer({ host, runtime: host.runtime, spine: createFakeSpine() });
  renderer.canRenderActor({ unitKey: 'scout_squad_default' });
  renderer.syncActors([{ id: 'a1', unitKey: 'scout_squad_default', facing: '3', x: 40, y: 60, scale: 0.5 }]);

  host.events.present.length = 0;
  host.events.cache.length = 0;
  assert.equal(renderer.renderFrame(), true);

  assert.deepEqual(host.events.present, []);
  assert.deepEqual(host.events.cache, ['worldActorSpine']);
});

test('WorldActorSpineRenderer fails closed on a render error and hands back to 2D', () => {
  const host = createFakeHost();
  const renderer = new WorldActorSpineRenderer({ host, runtime: host.runtime, spine: createFakeSpine({ batcherThrows: true }) });
  renderer.canRenderActor({ unitKey: 'scout_squad_default' });
  renderer.syncActors([{ id: 'a1', unitKey: 'scout_squad_default', facing: '3', x: 40, y: 60, scale: 0.5 }]);

  assert.equal(renderer.renderFrame(), false); // batcher.begin throws -> failClosed

  assert.equal(renderer.failed, true);
  assert.equal(renderer.canRenderActor({ unitKey: 'scout_squad_default' }), false);
  assert.equal(renderer.actors.size, 0);
  assert.deepEqual(host.events.visible.at(-1), { name: 'worldActorSpine', visible: false });
});

test('WorldActorSpineRenderer stays idle (no layer) when there is nothing to draw', () => {
  const host = createFakeHost();
  const renderer = new WorldActorSpineRenderer({ host, runtime: host.runtime, spine: createFakeSpine() });
  assert.equal(renderer.syncActors([]), false);
  assert.equal(renderer.actors.size, 0);
  // No layer work requested for an empty world.
  assert.deepEqual(host.events.visible, [{ name: 'worldActorSpine', visible: false }]);
});
