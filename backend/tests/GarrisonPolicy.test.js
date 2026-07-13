const test = require('node:test');
const assert = require('node:assert/strict');

const GarrisonPolicy = require('../services/territory/GarrisonPolicy');

// These assertions read the committed backend/config/generated/garrison.json:
//   safe <=3 undefended, near <=8, frontier <=16, deep <=9999 defended.

test('resolveBand maps a ring distance to its garrison band', () => {
  assert.equal(GarrisonPolicy.resolveBand(0)?.bandId, 'safe');
  assert.equal(GarrisonPolicy.resolveBand(3)?.bandId, 'safe');
  assert.equal(GarrisonPolicy.resolveBand(4)?.bandId, 'near');
  assert.equal(GarrisonPolicy.resolveBand(8)?.bandId, 'near');
  assert.equal(GarrisonPolicy.resolveBand(9)?.bandId, 'frontier');
  assert.equal(GarrisonPolicy.resolveBand(16)?.bandId, 'frontier');
  assert.equal(GarrisonPolicy.resolveBand(17)?.bandId, 'deep');
  assert.equal(GarrisonPolicy.resolveBand(9999)?.bandId, 'deep');
});

test('isNeutralCityDefended: safe spawn band + capital + non-neutral are undefended', () => {
  // safe band (<=3): frictionless settlement protects the spawn area.
  assert.equal(GarrisonPolicy.isNeutralCityDefended({ owner: 'neutral' }, 2), false);
  // near/frontier/deep neutral cities are defended.
  assert.equal(GarrisonPolicy.isNeutralCityDefended({ owner: 'neutral' }, 5), true);
  assert.equal(GarrisonPolicy.isNeutralCityDefended({ owner: 'neutral' }, 12), true);
  assert.equal(GarrisonPolicy.isNeutralCityDefended({ owner: 'neutral' }, 40), true);
  // the capital is never defended-against-you.
  assert.equal(GarrisonPolicy.isNeutralCityDefended({ owner: 'neutral', id: 'capital' }, 12), false);
  // only neutral cities are band-gated (hostile keeps its own logic; player is yours).
  assert.equal(GarrisonPolicy.isNeutralCityDefended({ owner: 'hostile' }, 12), false);
  assert.equal(GarrisonPolicy.isNeutralCityDefended({ owner: 'player' }, 12), false);
});

test('garrisonSoldiers scales base + perScale by site scale', () => {
  const near = GarrisonPolicy.resolveBand(5); // base 260, perScale 90
  assert.equal(GarrisonPolicy.garrisonSoldiers(near, 1), 350);
  assert.equal(GarrisonPolicy.garrisonSoldiers(near, 3), 530);
  assert.equal(GarrisonPolicy.garrisonSoldiers(near, 0), 350); // scale floored to 1
});

test('band capture/recruit rates are clamped fractions', () => {
  const near = GarrisonPolicy.resolveBand(5);
  assert.ok(GarrisonPolicy.bandCaptureChance(near) > 0 && GarrisonPolicy.bandCaptureChance(near) <= 1);
  assert.ok(GarrisonPolicy.bandRecruitBaseRate(near) > 0 && GarrisonPolicy.bandRecruitBaseRate(near) <= 1);
  const safe = GarrisonPolicy.resolveBand(1);
  assert.equal(GarrisonPolicy.bandCaptureChance(safe), 0); // no defender in the spawn band
  assert.equal(GarrisonPolicy.bandCaptureChance({ captureChance: 'x' }), 0); // non-finite -> 0
  assert.equal(GarrisonPolicy.bandCaptureChance({ captureChance: 5 }), 1); // clamped
});
