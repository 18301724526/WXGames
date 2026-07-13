const test = require('node:test');
const assert = require('node:assert/strict');

const ArmyFormationEditorController = require('./ArmyFormationEditorController');

// SHAPE-B single-owner contract: the controller owns the editor blob and reads game
// state only through host.getState(), so the SAME implementation must behave
// identically on an app-like host (getState -> this.state) and a shell-like host
// (getState -> this.lastGame.state). Facilities (render/toast/api/log) are explicit
// host callbacks recorded per test.

const FIXTURE_STATE = {
  currentTab: 'military',
  activeCityId: 'capital',
  military: {
    soldiers: 100,
    formations: {
      capital: [
        {
          slot: 1,
          memberIds: ['a', 'b'],
          maxSoldiersPerMember: 200,
          soldierAssignments: { a: 30, b: 20 },
        },
      ],
    },
  },
};

function sumStub(assignments = {}) {
  return ArmyFormationEditorController.sumArmyFormationAssignments(assignments);
}

function makeAppLikeHost(state, fields = {}) {
  return {
    state,
    calls: [],
    getState() {
      return this.state || {};
    },
    sumArmyFormationAssignments: sumStub,
    renderCanvasSurface(tab) {
      this.calls.push(['render', tab]);
    },
    showFloatingText(message) {
      this.calls.push(['toast', message]);
    },
    log(message) {
      this.calls.push(['log', message]);
    },
    ...fields,
  };
}

function makeShellLikeHost(state, fields = {}) {
  const host = makeAppLikeHost(null, fields);
  delete host.state;
  host.lastGame = { state };
  host.getState = function getState() {
    return this.lastGame.state || {};
  };
  return host;
}

const HOST_SHAPES = [
  ['app-like', makeAppLikeHost],
  ['shell-like', makeShellLikeHost],
];

for (const [shape, makeHost] of HOST_SHAPES) {
  test(`open seeds a normalized editor from the formation (${shape} host)`, () => {
    const host = makeHost(FIXTURE_STATE);
    const controller = new ArmyFormationEditorController({ host });

    assert.equal(controller.open({ slot: 1 }), true);
    assert.deepEqual(controller.editor, {
      open: true,
      cityId: 'capital',
      slot: 1,
      memberIds: ['a', 'b'],
      soldierAssignments: { a: 30, b: 20 },
      soldierDraftAssignments: { a: 30, b: 20 },
      page: 0,
      saving: false,
    });
    assert.deepEqual(host.calls, [['render', 'military']]);
  });

  test(`setSoldierDraft clamps to the remaining editable pool (${shape} host)`, () => {
    const host = makeHost(FIXTURE_STATE);
    const controller = new ArmyFormationEditorController({ host });
    controller.open({ slot: 1 });

    // pool = assigned (50) + reserve (100) = 150; b keeps 20 -> a caps at 130,
    // but the per-member cap (200) does not bind here.
    assert.equal(controller.setSoldierDraft('a', 500), true);
    assert.equal(controller.editor.soldierDraftAssignments.a, 130);
    assert.equal(controller.setSoldierDraft('missing', 10), false);
  });
}

test('toggleMember adds with zeroed assignments, removes, and enforces the 5-member cap', () => {
  const host = makeAppLikeHost(FIXTURE_STATE);
  const controller = new ArmyFormationEditorController({ host });
  controller.open({ slot: 1 });

  assert.equal(controller.toggleMember({ personId: 'c' }), true);
  assert.deepEqual(controller.editor.memberIds, ['a', 'b', 'c']);
  assert.equal(controller.editor.soldierAssignments.c, 0);

  assert.equal(controller.toggleMember({ personId: 'a' }), true);
  assert.deepEqual(controller.editor.memberIds, ['b', 'c']);
  assert.equal('a' in controller.editor.soldierAssignments, false);

  controller.toggleMember({ personId: 'd' });
  controller.toggleMember({ personId: 'e' });
  controller.toggleMember({ personId: 'f' });
  const toastsBefore = host.calls.filter(([kind]) => kind === 'toast').length;
  assert.equal(toastsBefore, 0);
  assert.equal(controller.toggleMember({ personId: 'g' }), false);
  assert.equal(host.calls.filter(([kind]) => kind === 'toast').length, 1);
  assert.deepEqual(controller.editor.memberIds, ['b', 'c', 'd', 'e', 'f']);
});

test('changePage clamps at zero and requires an open editor', () => {
  const host = makeAppLikeHost(FIXTURE_STATE);
  const controller = new ArmyFormationEditorController({ host });
  assert.equal(controller.changePage({ delta: 1 }), false);

  controller.open({ slot: 1 });
  assert.equal(controller.changePage({ delta: -3 }), true);
  assert.equal(controller.editor.page, 0);
  assert.equal(controller.changePage({ delta: 2 }), true);
  assert.equal(controller.editor.page, 2);
});

test('changeSoldiers maps the ratio onto the per-member cap through setSoldierDraft', () => {
  const host = makeAppLikeHost(FIXTURE_STATE);
  const controller = new ArmyFormationEditorController({ host });
  controller.open({ slot: 1 });

  assert.equal(controller.changeSoldiers({ personId: 'a', ratio: 0.5 }), true);
  assert.equal(controller.editor.soldierDraftAssignments.a, 100);
});

test('requestSoldierInput prompts through host.runtime and applies the draft', async () => {
  const host = makeAppLikeHost(FIXTURE_STATE, {
    runtime: {
      async requestTextInput(prompt) {
        return prompt.value === '30' ? '42' : '';
      },
    },
  });
  const controller = new ArmyFormationEditorController({ host });
  controller.open({ slot: 1 });

  assert.equal(await controller.requestSoldierInput({ personId: 'a' }), true);
  assert.equal(controller.editor.soldierDraftAssignments.a, 42);

  host.runtime = {
    async requestTextInput() {
      return '';
    },
  };
  assert.equal(await controller.requestSoldierInput({ personId: 'a' }), false);
});

test('autoReplenish distributes the pool across members up to the per-member cap', () => {
  const host = makeAppLikeHost(FIXTURE_STATE);
  const controller = new ArmyFormationEditorController({ host });
  controller.open({ slot: 1 });

  // pool = 50 assigned + 100 reserve = 150 across two members, cap 200 -> 75/75.
  assert.equal(controller.autoReplenish(), true);
  assert.deepEqual(controller.editor.soldierDraftAssignments, { a: 75, b: 75 });
  assert.deepEqual(controller.editor.soldierAssignments, { a: 30, b: 20 });
});

test('save posts the normalized draft, closes, and publishes the completion event', async () => {
  const apiCalls = [];
  const host = makeAppLikeHost(FIXTURE_STATE, {
    getGameApi() {
      return {
        async setArmyFormation(cityId, slot, memberIds, soldierAssignments) {
          apiCalls.push([cityId, slot, memberIds, soldierAssignments]);
          return { message: 'saved' };
        },
      };
    },
    applyApiState() {},
    emitGameEvent(eventName, payload) {
      assert.equal(eventName, 'armyFormationSaved');
      assert.equal(payload.result.message, 'saved');
      return true;
    },
  });
  const controller = new ArmyFormationEditorController({ host });
  controller.open({ slot: 1 });
  controller.setSoldierDraft('a', 130, { render: false });

  assert.equal(await controller.save(), true);
  assert.deepEqual(apiCalls, [['capital', 1, ['a', 'b'], { a: 130, b: 20 }]]);
  assert.equal(controller.editor.open, false);
  assert.equal(host.calls.filter(([kind]) => kind === 'render').length, 3);
});

test('save failure resets saving, surfaces the message, and re-renders', async () => {
  const host = makeAppLikeHost(FIXTURE_STATE, {
    getGameApi() {
      return {
        async setArmyFormation() {
          const error = new Error('boom');
          error.payload = { message: 'save rejected' };
          throw error;
        },
      };
    },
    applyApiState() {},
  });
  const controller = new ArmyFormationEditorController({ host });
  controller.open({ slot: 1 });

  assert.equal(await controller.save(), false);
  assert.equal(controller.editor.saving, false);
  assert.equal(controller.editor.open, true);
  assert.deepEqual(
    host.calls.filter(([kind]) => kind !== 'render'),
    [
      ['toast', 'save rejected'],
      ['log', 'save rejected'],
    ],
  );
});

test('replaceEditor normalizes legacy direct assignments through the UI runtime store', () => {
  const controller = new ArmyFormationEditorController({ host: makeAppLikeHost({}) });
  assert.equal(controller.replaceEditor(false), true);
  assert.deepEqual(controller.editor, {
    open: false,
    cityId: '',
    slot: 1,
    memberIds: [],
    soldierAssignments: {},
    soldierDraftAssignments: {},
    page: 0,
    saving: false,
  });
  const blob = { open: true, cityId: 'x' };
  controller.replaceEditor(blob);
  assert.deepEqual(controller.editor, {
    open: true,
    cityId: 'x',
    slot: 1,
    memberIds: [],
    soldierAssignments: {},
    soldierDraftAssignments: {},
    page: 0,
    saving: false,
  });
});

test('close resets to the closed default and honours render:false', () => {
  const host = makeAppLikeHost(FIXTURE_STATE);
  const controller = new ArmyFormationEditorController({ host });
  controller.open({ slot: 1 });
  host.calls.length = 0;

  assert.equal(controller.close({ render: false }), true);
  assert.deepEqual(controller.editor, {
    open: false,
    cityId: '',
    slot: 1,
    memberIds: [],
    soldierAssignments: {},
    soldierDraftAssignments: {},
    page: 0,
    saving: false,
  });
  assert.deepEqual(host.calls, []);
});
