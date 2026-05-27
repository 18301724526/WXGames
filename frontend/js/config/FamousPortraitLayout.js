(function (global) {
  const FamousPortraitLayout = Object.freeze({
    version: 2,
    mode: 'cropped',
    coordinateSize: 512,
    assetBase: 'assets/art/famous-person/layers/',
    global: Object.freeze({
      scale: 1,
      x: 0,
      y: 0,
    }),
    order: Object.freeze([
      'backHair',
      'body',
      'innerwear',
      'sideHair',
      'frontHair',
      'bangs',
      'outfit',
    ]),
    layers: Object.freeze({
      backHair: Object.freeze({
        file: 'fp-layer-v2-backHair-short-01.png',
        base: Object.freeze({ x: 136, y: 64, width: 244.333, height: 249.667 }),
        x: 0,
        y: 0,
        scale: 1,
      }),
      body: Object.freeze({
        file: 'fp-layer-v2-body-base-01.png',
        base: Object.freeze({ x: 110, y: 92, width: 292.667, height: 420.333 }),
        x: 0,
        y: 0,
        scale: 1,
      }),
      innerwear: Object.freeze({
        file: 'fp-layer-v2-innerwear-guardian-01.png',
        base: Object.freeze({ x: 154, y: 365, width: 204.333, height: 146.667 }),
        x: 0,
        y: 0,
        scale: 1,
      }),
      sideHair: Object.freeze({
        file: 'fp-layer-v2-sideHair-short-01.png',
        base: Object.freeze({ x: 136, y: 171, width: 240.333, height: 143.333 }),
        x: 0,
        y: 0,
        scale: 1,
      }),
      frontHair: Object.freeze({
        file: 'fp-layer-v2-frontHair-short-01.png',
        base: Object.freeze({ x: 156, y: 96, width: 199.333, height: 95.333 }),
        x: 0,
        y: 0,
        scale: 1,
      }),
      bangs: Object.freeze({
        file: 'fp-layer-v2-bangs-short-01.png',
        base: Object.freeze({ x: 201, y: 149, width: 106.333, height: 82.333 }),
        x: 0,
        y: 0,
        scale: 1,
      }),
      outfit: Object.freeze({
        file: 'fp-layer-v2-outfit-guardian-01.png',
        base: Object.freeze({ x: 71, y: 351, width: 370.333, height: 161 }),
        x: 0,
        y: 0,
        scale: 1,
      }),
    }),
  });

  global.FamousPortraitLayout = FamousPortraitLayout;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = FamousPortraitLayout;
  }
})(typeof window !== 'undefined' ? window : globalThis);
