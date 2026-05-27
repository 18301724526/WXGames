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
      'hair',
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
      hair: Object.freeze({
        file: 'fp-layer-v2-art01-hair-bound-topknot-01.png',
        base: Object.freeze({ x: 0, y: 0, width: 1254, height: 1254 }),
        x: 135,
        y: 20,
        scale: 0.19,
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
