(function (global) {
  const makeFiles = (type) => Object.freeze(Array.from({ length: 10 }, (_, index) => (
    `fp-layer-v3-${type}-${String(index + 1).padStart(2, '0')}.png`
  )));

  const outfitFiles = makeFiles('outfit');
  const faceFiles = makeFiles('face');
  const hairFiles = makeFiles('hair');
  const fullCanvas = Object.freeze({ x: 0, y: 0, width: 512, height: 512 });

  const FamousPortraitLayout = Object.freeze({
    version: 3,
    mode: 'stacked',
    coordinateSize: 512,
    assetVersion: 'famous-portrait-v3-fixedgrid-20260528',
    assetBase: 'assets/art/famous-person/layers/',
    global: Object.freeze({
      scale: 1,
      x: 0,
      y: 0,
    }),
    order: Object.freeze([
      'outfit',
      'face',
      'hair',
    ]),
    layers: Object.freeze({
      outfit: Object.freeze({
        file: outfitFiles[0],
        options: outfitFiles,
        base: fullCanvas,
        x: 0,
        y: 0,
        scale: 1,
      }),
      face: Object.freeze({
        file: faceFiles[0],
        options: faceFiles,
        base: fullCanvas,
        x: 0,
        y: 0,
        scale: 1,
      }),
      hair: Object.freeze({
        file: hairFiles[0],
        options: hairFiles,
        base: fullCanvas,
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
