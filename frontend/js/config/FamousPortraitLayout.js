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
    assetVersion: 'famous-portrait-v3-upperbody-20260529',
    assetBase: 'assets/art/famous-person/layers/',
    global: Object.freeze({
      scale: 1,
      x: 0,
      y: 0,
    }),
    order: Object.freeze([
      'face',
      'outfit',
      'hair',
    ]),
    layers: Object.freeze({
      outfit: Object.freeze({
        file: outfitFiles[0],
        options: outfitFiles,
        base: fullCanvas,
        x: 0,
        y: 83,
        scale: 2,
      }),
      face: Object.freeze({
        file: faceFiles[0],
        options: faceFiles,
        base: fullCanvas,
        x: 0,
        y: 3,
        scale: 0.88,
      }),
      hair: Object.freeze({
        file: hairFiles[9],
        options: hairFiles,
        base: fullCanvas,
        x: 8,
        y: -90,
        scale: 0.88,
      }),
    }),
  });

  global.FamousPortraitLayout = FamousPortraitLayout;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = FamousPortraitLayout;
  }
})(typeof window !== 'undefined' ? window : globalThis);
