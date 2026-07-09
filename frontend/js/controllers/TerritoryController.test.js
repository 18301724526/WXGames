const test = require('node:test');
const assert = require('node:assert/strict');

const TerritoryController = require('./TerritoryController');

test('TerritoryController surfaces expedition domain rejection without throwing', async () => {
  const calls = [];
  const state = {
    famousPersons: {
      people: [{ id: 'leader-1', roles: ['military'] }],
    },
    territoryState: {
      territories: [{ id: 'site-1', recommendedSoldiers: 10, defense: 10 }],
    },
  };
  const controller = new TerritoryController({
    api: {
      async startConquest(territoryId, expedition) {
        calls.push(['startConquest', territoryId, expedition]);
        const error = new Error('insufficient soldiers');
        error.payload = { error: 'INSUFFICIENT_SOLDIERS', message: 'not enough soldiers' };
        throw error;
      },
    },
    actionAdapter: {
      setLoading(_button, loading) {
        calls.push(['loading', loading]);
      },
    },
    getState: () => state,
    onFloatingText(message) {
      calls.push(['floating', message]);
    },
    onLog(message) {
      calls.push(['log', message]);
    },
  });
  controller.setExpeditionDraft({
    territoryId: 'site-1',
    troopType: 'unavailable',
    leader: 'leader-1',
    soldiers: 10,
  });

  assert.equal(await controller.handleAction({
    territoryId: 'site-1',
    action: 'launch-expedition',
    button: {},
  }), false);
  assert.deepEqual(calls, [
    ['loading', true],
    ['startConquest', 'site-1', {
      troopType: 'unavailable',
      leader: 'leader-1',
      soldiers: 10,
    }],
    ['floating', 'not enough soldiers'],
    ['log', 'not enough soldiers'],
    ['loading', false],
  ]);
});
