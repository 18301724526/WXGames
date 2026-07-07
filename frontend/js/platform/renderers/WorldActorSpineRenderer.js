(function (global) {
  // One WebGL context, many skeletons. SpineWebglPlayer renders exactly one skeleton fitted
  // to its own context; the marching world needs N armies positioned at world->screen points
  // on ONE offscreen webgl layer (the layer/compositor model is one canvas per layer). So this
  // renderer reuses spine's proven SkeletonRenderer/PolygonBatcher/Shader primitives but draws
  // every actor skeleton between one batcher.begin/end with a screen-space camera.
  //
  // It is a fully optional plugin: the world actor renderer only routes actors here when
  // canRenderActor() is true, and any failure flips it closed so every actor falls back to the
  // 2D sprite path with no visible regression.

  const LAYER_NAME = 'worldActorSpine';
  // On-screen skeleton height (css px) at frame.scale 1.0; the per-actor frame.scale (0.32..0.62)
  // scales it down to roughly match the 2D sprite footprint (~86px). Tunable during live verify.
  const SCREEN_HEIGHT_PER_UNIT = 90;

  function resolveUnitSpriteManifest(runtime) {
    if (runtime?.UnitSpriteManifest) return runtime.UnitSpriteManifest;
    if (global.UnitSpriteManifest) return global.UnitSpriteManifest;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../../config/UnitSpriteManifest');
      } catch (_error) {
        return null;
      }
    }
    return null;
  }

  class WorldActorSpineRenderer {
    constructor(options = {}) {
      // host = the shell: ensureCanvasLayer / setCanvasLayerVisible / h5Runtime|runtime, width/height.
      this.host = options.host || null;
      this.runtime = options.runtime || this.host?.h5Runtime || this.host?.runtime || global;
      this.spine = options.spine || null;
      this.manifest = options.manifest || null;
      this.layerName = options.layerName || LAYER_NAME;

      this.canvas = null;
      this.context = null;
      this.gl = null;
      this.shader = null;
      this.batcher = null;
      this.mvp = null;
      this.skeletonRenderer = null;

      // descriptorId -> { skeletonData, native:{width,height,offsetY} } | 'loading'
      this.skeletonAssets = Object.create(null);
      this.assetManagers = Object.create(null);
      // actorId -> { skeleton, animationState, descriptorId, animName, x, y, scale }
      this.actors = new Map();

      this.failed = false;
      this.animationFrame = null;
      this.animationFrameType = '';
      this.lastFrameTime = 0;
      this.targetFps = Number(options.targetFps) || 30;
      this.frameIntervalMs = this.targetFps > 0 ? 1000 / this.targetFps : 33;
      this.viewport = { width: 0, height: 0 };
    }

    getSpine() {
      if (!this.spine) this.spine = this.runtime?.spine || global.spine || null;
      return this.spine;
    }

    getManifest() {
      if (!this.manifest) this.manifest = resolveUnitSpriteManifest(this.runtime);
      return this.manifest;
    }

    isAvailable() {
      if (this.failed) return false;
      const spine = this.getSpine();
      if (!spine) return false;
      const SpinePlayer = this.runtime?.SpineWebglPlayer || global.SpineWebglPlayer || null;
      if (SpinePlayer?.isAvailable) return SpinePlayer.isAvailable(spine);
      return Boolean(spine.webgl && spine.SkeletonJson && spine.AtlasAttachmentLoader);
    }

    getDescriptor(unitKey = '') {
      return this.getManifest()?.getSpineDescriptor?.(unitKey) || null;
    }

    // The 2D renderer asks this before routing an actor here. Return true only once the
    // skeleton data is loaded so there is never a blank actor; kick off the (small) async load
    // and the webgl context on the way so the next few frames converge to spine.
    canRenderActor(actor = {}) {
      if (this.failed || !this.isAvailable()) return false;
      const descriptor = this.getDescriptor(actor?.unitKey);
      if (!descriptor) return false;
      if (!this.ensureContext()) return false;
      this.ensureSkeletonAsset(descriptor);
      return Boolean(this.skeletonAssets[descriptor.id]?.skeletonData);
    }

    getHostViewport() {
      const width = Math.max(1, Number(this.host?.width) || Number(this.runtime?.width) || 0);
      const height = Math.max(1, Number(this.host?.height) || Number(this.runtime?.height) || 0);
      return { width, height };
    }

    getPixelRatio() {
      return Math.min(2, Math.max(1, Number(this.runtime?.devicePixelRatio) || Number(global.devicePixelRatio) || 1));
    }

    // The world map/actor layers are drawn onto a surface padded by the drag-cache pan range, and
    // actor screen points are computed in THAT padded space. The spine layer must share the same
    // padding so a point lands on the same pixel and the compositor crops it identically — this is
    // what keeps the skeleton root pinned to the march route (and lets a pan translate track it).
    getLayerPadding() {
      return Math.max(0, Number(this.host?.getWorldMapLayerPadding?.()) || 0);
    }

    // The padded draw surface's real dimensions. The runtime sizes the layer canvas to the padded
    // viewport, so read its backing size directly; fall back to the padded host viewport before the
    // first runtime resize. Everything (ortho camera, gl viewport, root Y-flip) derives from here.
    resolveSurfaceMetrics() {
      const ratio = this.getPixelRatio();
      const canvas = this.canvas;
      let backingW = Math.max(0, Math.floor(Number(canvas?.width) || 0));
      let backingH = Math.max(0, Math.floor(Number(canvas?.height) || 0));
      if (backingW < 2 || backingH < 2) {
        const pad = this.getLayerPadding();
        const host = this.getHostViewport();
        backingW = Math.max(1, Math.round((host.width + pad * 2) * ratio));
        backingH = Math.max(1, Math.round((host.height + pad * 2) * ratio));
        if (canvas) {
          if (canvas.width !== backingW) canvas.width = backingW;
          if (canvas.height !== backingH) canvas.height = backingH;
        }
      }
      return { ratio, backingW, backingH, cssW: backingW / ratio, cssH: backingH / ratio };
    }

    ensureContext() {
      if (this.failed) return false;
      if (this.gl && this.canvas) return true;
      try {
        const spine = this.getSpine();
        if (!spine) return false;
        const pixelRatio = this.getPixelRatio();
        const layerOptions = { contextType: 'webgl', pixelRatio, padding: this.getLayerPadding() };
        const canvas = typeof this.host?.ensureCanvasLayer === 'function'
          ? this.host.ensureCanvasLayer(this.layerName, layerOptions)
          : this.runtime?.ensureLayerCanvas?.(this.layerName, layerOptions);
        if (!canvas) return false;
        if (typeof canvas.addEventListener !== 'function') canvas.addEventListener = () => {};
        if (typeof canvas.removeEventListener !== 'function') canvas.removeEventListener = () => {};
        this.canvas = canvas;
        this.context = new spine.webgl.ManagedWebGLRenderingContext(canvas, {
          alpha: true,
          premultipliedAlpha: false,
          antialias: true,
          preserveDrawingBuffer: false,
        });
        this.gl = this.context.gl;
        if (!this.gl) throw new Error('WebGL unavailable for world actor spine layer');
        this.shader = spine.webgl.Shader.newTwoColoredTextured(this.gl);
        this.batcher = new spine.webgl.PolygonBatcher(this.gl);
        this.mvp = new spine.webgl.Matrix4();
        this.skeletonRenderer = new spine.webgl.SkeletonRenderer(this.gl);
        return true;
      } catch (error) {
        this.failClosed(error);
        return false;
      }
    }

    ensureSkeletonAsset(descriptor = {}) {
      const id = descriptor.id;
      if (!id || this.failed) return null;
      const existing = this.skeletonAssets[id];
      if (existing) return existing === 'loading' ? null : existing;
      if (!this.ensureContext()) return null;
      try {
        const spine = this.getSpine();
        const assetBase = String(descriptor.assetBase || '').replace(/\/?$/, '/');
        const manager = new spine.webgl.AssetManager(this.context, assetBase);
        manager.loadText(descriptor.jsonFile);
        manager.loadTextureAtlas(descriptor.atlasFile);
        this.assetManagers[id] = { manager, descriptor };
        this.skeletonAssets[id] = 'loading';
        this.pumpAssetLoad(id);
        return null;
      } catch (error) {
        this.failClosed(error);
        return null;
      }
    }

    pumpAssetLoad(id) {
      const record = this.assetManagers[id];
      if (!record || this.failed) return;
      const { manager, descriptor } = record;
      try {
        if (!manager.isLoadingComplete()) {
          this.requestFrame(() => this.pumpAssetLoad(id));
          return;
        }
        const spine = this.getSpine();
        const atlas = manager.get(descriptor.atlasFile);
        const atlasLoader = new spine.AtlasAttachmentLoader(atlas);
        const skeletonJson = new spine.SkeletonJson(atlasLoader);
        skeletonJson.scale = 1;
        const skeletonData = skeletonJson.readSkeletonData(manager.get(descriptor.jsonFile));
        const native = this.measureSkeleton(skeletonData);
        this.skeletonAssets[id] = { skeletonData, native };
        delete this.assetManagers[id];
        this.requestOverlayRenderFrame();
      } catch (error) {
        this.failClosed(error);
      }
    }

    measureSkeleton(skeletonData) {
      try {
        const spine = this.getSpine();
        const skeleton = new spine.Skeleton(skeletonData);
        skeleton.setToSetupPose();
        skeleton.updateWorldTransform();
        const offset = new spine.Vector2();
        const size = new spine.Vector2();
        skeleton.getBounds(offset, size, []);
        return {
          width: Math.max(1, Number(size.x) || 1),
          height: Math.max(1, Number(size.y) || 1),
          offsetY: Number(offset.y) || 0,
        };
      } catch (_error) {
        return { width: 1, height: 1, offsetY: 0 };
      }
    }

    createActorEntry(descriptorId, unitKey) {
      const asset = this.skeletonAssets[descriptorId];
      if (!asset?.skeletonData) return null;
      try {
        const spine = this.getSpine();
        const skeleton = new spine.Skeleton(asset.skeletonData);
        const stateData = new spine.AnimationStateData(asset.skeletonData);
        stateData.defaultMix = 0.08;
        const animationState = new spine.AnimationState(stateData);
        return {
          skeleton,
          animationState,
          descriptorId,
          unitKey,
          animName: '',
          x: 0,
          y: 0,
          scale: 0.5,
          native: asset.native,
        };
      } catch (error) {
        this.failClosed(error);
        return null;
      }
    }

    // Reconcile the live skeleton pool with the frame list produced by the 2D renderer:
    // (id, unitKey, facing, screen x/y, scale). Add new armies, retarget the ones present,
    // drop the ones gone, and keep the animation loop alive only while anything is on screen.
    syncActors(frames = [], _viewport = null) {
      if (this.failed) return false;
      const list = Array.isArray(frames) ? frames : [];
      if (!list.length && !this.actors.size) {
        this.stopLoop();
        this.setLayerVisible(false);
        return false;
      }
      if (!this.ensureContext()) {
        this.failClosed('context');
        return false;
      }
      const manifest = this.getManifest();
      const seen = new Set();
      list.forEach((frame) => {
        const id = frame?.id;
        if (!id) return;
        const descriptor = this.getDescriptor(frame.unitKey);
        if (!descriptor || !this.skeletonAssets[descriptor.id]?.skeletonData) return;
        let entry = this.actors.get(id);
        if (!entry || entry.descriptorId !== descriptor.id) {
          if (entry) this.actors.delete(id);
          entry = this.createActorEntry(descriptor.id, frame.unitKey);
          if (!entry) return;
          this.actors.set(id, entry);
        }
        seen.add(id);
        const animName = (manifest?.getDirectionAnimation?.(frame.unitKey, frame.facing))
          || descriptor.directions?.[descriptor.defaultDirection]
          || '';
        if (animName && entry.animName !== animName) {
          entry.animationState.setAnimation(0, animName, descriptor.loop !== false);
          entry.animName = animName;
        }
        entry.x = Number(frame.x) || 0;
        entry.y = Number(frame.y) || 0;
        entry.scale = Number(frame.scale) || 0.5;
      });
      for (const id of [...this.actors.keys()]) {
        if (!seen.has(id)) this.actors.delete(id);
      }
      if (this.actors.size) {
        this.setLayerVisible(true);
        this.startLoop();
      } else {
        this.setLayerVisible(false);
        this.stopLoop();
        this.clearSurface();
      }
      return true;
    }

    startLoop() {
      if (this.failed || this.animationFrame) return;
      this.lastFrameTime = this.nowSeconds();
      this.animationFrame = this.scheduleFrame();
    }

    stopLoop() {
      if (!this.animationFrame) return;
      if (this.animationFrameType === 'timeout') this.runtime?.clearTimeout?.(this.animationFrame);
      else if (typeof this.runtime?.cancelAnimationFrame === 'function') this.runtime.cancelAnimationFrame(this.animationFrame);
      else this.runtime?.clearTimeout?.(this.animationFrame);
      this.animationFrame = null;
      this.animationFrameType = '';
    }

    scheduleFrame() {
      const interval = Math.max(16, Number(this.frameIntervalMs) || 33);
      if (interval > 20 && typeof this.runtime?.setTimeout === 'function') {
        this.animationFrameType = 'timeout';
        return this.runtime.setTimeout(() => this.renderFrame(), interval);
      }
      return this.requestFrame(() => this.renderFrame());
    }

    requestFrame(callback) {
      if (typeof this.runtime?.requestAnimationFrame === 'function') {
        this.animationFrameType = 'raf';
        return this.runtime.requestAnimationFrame(callback);
      }
      this.animationFrameType = 'timeout';
      return this.runtime?.setTimeout?.(callback, 16);
    }

    renderFrame() {
      this.animationFrame = null;
      if (this.failed || !this.gl || !this.actors.size) return;
      try {
        const spine = this.getSpine();
        const gl = this.gl;
        const now = this.nowSeconds();
        const delta = Math.min(0.08, Math.max(0, now - this.lastFrameTime));
        this.lastFrameTime = now;

        const surf = this.resolveSurfaceMetrics();
        gl.viewport(0, 0, surf.backingW, surf.backingH);
        this.mvp.ortho2d(0, 0, surf.cssW, surf.cssH);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        this.shader.bind();
        this.shader.setUniformi(spine.webgl.Shader.SAMPLER, 0);
        this.shader.setUniform4x4f(spine.webgl.Shader.MVP_MATRIX, this.mvp.values);
        this.batcher.begin(this.shader);
        this.skeletonRenderer.premultipliedAlpha = false;
        for (const entry of this.actors.values()) {
          const skeleton = entry.skeleton;
          const scale = this.resolveEntryScale(entry);
          skeleton.scaleX = scale;
          skeleton.scaleY = scale;
          // entry.x/y are the actor's screen point in the padded layer space (root == feet, so
          // the skeleton root lands exactly on the march route). The spine camera is y-up.
          skeleton.x = entry.x;
          skeleton.y = surf.cssH - entry.y;
          entry.animationState.update(delta);
          entry.animationState.apply(skeleton);
          skeleton.updateWorldTransform();
          this.skeletonRenderer.draw(this.batcher, skeleton);
        }
        this.batcher.end();
        this.shader.unbind();
        this.present();
        this.animationFrame = this.scheduleFrame();
      } catch (error) {
        this.failClosed(error);
      }
    }

    resolveEntryScale(entry = {}) {
      const nativeHeight = Math.max(1, Number(entry.native?.height) || 1);
      const target = SCREEN_HEIGHT_PER_UNIT * (Number(entry.scale) || 0.5);
      return target / nativeHeight;
    }

    present() {
      const runtime = this.host?.h5Runtime || this.host?.runtime || this.runtime;
      if (typeof runtime?.presentLayer === 'function') return runtime.presentLayer(this.layerName);
      if (typeof runtime?.refreshLayerPresentCache === 'function') {
        return runtime.refreshLayerPresentCache(this.layerName);
      }
      return false;
    }

    clearSurface() {
      try {
        if (this.gl) {
          this.gl.clearColor(0, 0, 0, 0);
          this.gl.clear(this.gl.COLOR_BUFFER_BIT);
          this.present();
        }
      } catch (_error) {
        // Clearing is best-effort; a dead context is handled by failClosed elsewhere.
      }
    }

    setLayerVisible(visible) {
      if (typeof this.host?.setCanvasLayerVisible === 'function') this.host.setCanvasLayerVisible(this.layerName, visible !== false);
      else this.runtime?.setLayerVisible?.(this.layerName, visible !== false);
    }

    requestOverlayRenderFrame() {
      this.host?.requestOverlayRenderFrame?.();
    }

    nowSeconds() {
      const perf = this.runtime?.performance || global.performance;
      if (perf && typeof perf.now === 'function') return perf.now() / 1000;
      return 0;
    }

    // Any error retires the spine layer for the session: hide it, drop all state, and let the
    // 2D sprite path take over on the next frame (canRenderActor now returns false).
    failClosed(_error) {
      this.failed = true;
      this.stopLoop();
      this.actors.clear();
      this.setLayerVisible(false);
      try {
        this.clearSurface();
      } catch (_ignored) {
        // ignore
      }
    }
  }

  global.WorldActorSpineRenderer = WorldActorSpineRenderer;
  if (typeof module !== 'undefined' && module.exports) module.exports = WorldActorSpineRenderer;
})(typeof window !== 'undefined' ? window : globalThis);
