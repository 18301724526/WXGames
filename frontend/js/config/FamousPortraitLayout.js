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
        file: 'fp-layer-v2-art01-backHair-short-01.png',
        base: Object.freeze({ x: 67.067, y: 81.659, width: 346.786, height: 311.936 }),
        x: 72,
        y: 5,
        scale: 0.66,
      }),
      body: Object.freeze({
        file: 'fp-layer-v2-art01-body-base-01.png',
        base: Object.freeze({ x: 17.936, y: 96.357, width: 492.433, height: 348.683 }),
        x: 72,
        y: 18,
        scale: 0.72,
      }),
      innerwear: Object.freeze({
        file: 'fp-layer-v2-art01-innerwear-guardian-01.png',
        base: Object.freeze({ x: 1.636, y: 226.195, width: 510.364, height: 285.805 }),
        x: 112,
        y: 80,
        scale: 0.48,
      }),
      sideHair: Object.freeze({
        file: 'fp-layer-v2-art01-sideHair-short-01.png',
        base: Object.freeze({ x: 47.287, y: 133.92, width: 422.318, height: 203.33 }),
        x: 118,
        y: 30,
        scale: 0.45,
      }),
      frontHair: Object.freeze({
        file: 'fp-layer-v2-art01-frontHair-short-01.png',
        base: Object.freeze({ x: 11.45, y: 0, width: 498.914, height: 343.783 }),
        x: 130,
        y: 20,
        scale: 0.44,
      }),
      bangs: Object.freeze({
        file: 'fp-layer-v2-art01-bangs-short-01.png',
        base: Object.freeze({ x: 70.115, y: 0, width: 441.885, height: 262.124 }),
        x: 116,
        y: 65,
        scale: 0.36,
      }),
      outfit: Object.freeze({
        file: 'fp-layer-v2-art01-outfit-guardian-01.png',
        base: Object.freeze({ x: 0, y: 7.349, width: 500.586, height: 504.651 }),
        x: 54,
        y: 160,
        scale: 0.82,
      }),
    }),
  });

  global.FamousPortraitLayout = FamousPortraitLayout;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = FamousPortraitLayout;
  }
})(typeof window !== 'undefined' ? window : globalThis);
