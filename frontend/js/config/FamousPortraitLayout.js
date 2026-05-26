(function (global) {
  const FamousPortraitLayout = Object.freeze({
    backHair: Object.freeze({ scale: 0.7, x: 0, y: -70 }),
    sideHair: Object.freeze({ scale: 0.7, x: 0, y: -75 }),
    body: Object.freeze({ scale: 0.7, x: 0, y: -17 }),
    outfit: Object.freeze({ scale: 1.21, x: 0, y: 53 }),
    frontHair: Object.freeze({ scale: 0.7, x: 0, y: -65 }),
    accessory: Object.freeze({ scale: 1, x: 0, y: 0 }),
    face: Object.freeze({ scale: 1, x: 0, y: 0 }),
    frameEffect: Object.freeze({ scale: 1, x: 0, y: 0 }),
  });

  global.FamousPortraitLayout = FamousPortraitLayout;
  if (typeof module !== 'undefined' && module.exports) module.exports = FamousPortraitLayout;
})(typeof window !== 'undefined' ? window : globalThis);
