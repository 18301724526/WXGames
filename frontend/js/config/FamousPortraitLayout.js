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
      'outfitBack',
      'head',
      'hairBase',
      'bangs',
      'outfitFront',
    ]),
    layers: Object.freeze({
      outfitBack: Object.freeze({
        file: 'fp-layer-v2-art01-outfitBack-guardian-01.png',
        base: Object.freeze({ x: 0, y: 0, width: 336, height: 239 }),
        x: 172,
        y: 231,
        scale: 0.48,
      }),
      head: Object.freeze({
        file: 'fp-layer-v2-art01-head-base-01.png',
        base: Object.freeze({ x: 0, y: 0, width: 530, height: 750 }),
        x: 133,
        y: 83,
        scale: 0.46,
      }),
      hairBase: Object.freeze({
        file: 'fp-layer-v2-art01-hairBase-bound-topknot-filled-01.png',
        base: Object.freeze({ x: 0, y: 0, width: 1254, height: 1254 }),
        x: 135,
        y: 20,
        scale: 0.19,
      }),
      bangs: Object.freeze({
        file: 'fp-layer-v2-art01-bangs-bound-topknot-swept-01.png',
        base: Object.freeze({ x: 0, y: 0, width: 1254, height: 1254 }),
        x: 15,
        y: -40,
        scale: 0.38,
      }),
      outfitFront: Object.freeze({
        file: 'fp-layer-v2-art01-outfitFront-guardian-01.png',
        base: Object.freeze({ x: 0, y: 0, width: 1084, height: 950 }),
        x: -5,
        y: 249,
        scale: 0.48,
      }),
    }),
  });

  global.FamousPortraitLayout = FamousPortraitLayout;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = FamousPortraitLayout;
  }
})(typeof window !== 'undefined' ? window : globalThis);
