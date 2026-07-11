const test = require('node:test');
const assert = require('node:assert/strict');

const ModalStore = require('./ModalStore');
const ChangeEventBus = require('./ChangeEventBus');

function resetModalStore() {
  // ModalStore is a module-level singleton; close every subtype touched by tests so
  // each test sees a clean truth. Presence is computed, so closing clears it.
  [
    'modal:naming',
    'modal:event',
    'modal:confirmDialog',
    'modal:rewardReveal',
    'modal:taskCenter',
  ].forEach((subtype) => ModalStore.closeModal(subtype));
}

test('a freshly closed store reports no presence', () => {
  resetModalStore();
  assert.equal(ModalStore.isOpen('modal:naming'), false);
  assert.equal(ModalStore.getPayload('modal:naming'), null);
  assert.equal(ModalStore.getToken('modal:naming'), '');
});

test('openModal sets presence, a subtype-embedded token, and a frozen payload', () => {
  resetModalStore();
  const token = ModalStore.openModal('modal:naming', { visible: true, inputValue: 'a' });
  assert.equal(ModalStore.isOpen('modal:naming'), true);
  assert.equal(token, ModalStore.getToken('modal:naming'));
  assert.equal(token.slice(0, token.lastIndexOf('#')), 'modal:naming');
  assert.deepEqual(ModalStore.getPayload('modal:naming'), { visible: true, inputValue: 'a' });
  assert.equal(Object.isFrozen(ModalStore.getPayload('modal:naming')), true);
});

test('openModal mints strictly incrementing tokens', () => {
  resetModalStore();
  const t1 = ModalStore.openModal('modal:naming', {});
  const t2 = ModalStore.openModal('modal:event', {});
  assert.notEqual(t1, t2);
  const seq1 = Number(t1.slice(t1.lastIndexOf('#') + 1));
  const seq2 = Number(t2.slice(t2.lastIndexOf('#') + 1));
  assert.equal(seq2, seq1 + 1);
});

test('updateModalPayload patches an open modal and no-ops on a closed one', () => {
  resetModalStore();
  ModalStore.openModal('modal:naming', { inputValue: '' });
  const tokenBefore = ModalStore.getToken('modal:naming');
  ModalStore.updateModalPayload('modal:naming', { inputValue: 'hi', submitting: true });
  assert.deepEqual(ModalStore.getPayload('modal:naming'), { inputValue: 'hi', submitting: true });
  assert.equal(ModalStore.getToken('modal:naming'), tokenBefore); // token preserved

  ModalStore.closeModal('modal:naming');
  assert.equal(ModalStore.updateModalPayload('modal:naming', { inputValue: 'x' }), null);
  assert.equal(ModalStore.isOpen('modal:naming'), false);
});

test('closeModal clears presence, payload, and token', () => {
  resetModalStore();
  ModalStore.openModal('modal:naming', { visible: true });
  ModalStore.closeModal('modal:naming');
  assert.equal(ModalStore.isOpen('modal:naming'), false);
  assert.equal(ModalStore.getPayload('modal:naming'), null);
  assert.equal(ModalStore.getToken('modal:naming'), '');
});

test('resolve invokes a continuation by token and is inert after close', () => {
  resetModalStore();
  let confirmed = 0;
  const token = ModalStore.openModal(
    'modal:confirmDialog',
    { kind: 'resetGame' },
    { onConfirm: () => (confirmed += 1) },
  );
  ModalStore.resolve(token, 'onConfirm');
  assert.equal(confirmed, 1);

  ModalStore.closeModal('modal:confirmDialog');
  ModalStore.resolve(token, 'onConfirm'); // cleared on close -> inert
  assert.equal(confirmed, 1);
});

test('resolve rejects a stale token after the subtype was reopened', () => {
  resetModalStore();
  let firstCalls = 0;
  const staleToken = ModalStore.openModal(
    'modal:confirmDialog',
    {},
    { onConfirm: () => (firstCalls += 1) },
  );
  // reopen mints a new token; the stale token must no longer resolve
  ModalStore.openModal('modal:confirmDialog', {}, { onConfirm: () => (firstCalls += 100) });
  ModalStore.resolve(staleToken, 'onConfirm');
  assert.equal(firstCalls, 0);
  ModalStore.closeModal('modal:confirmDialog');
});

test('buildModalSnapshot reconstructs the { open, token, payload } entry shape', () => {
  resetModalStore();
  const token = ModalStore.openModal('modal:event', { eventId: 'e1' });
  const snapshot = ModalStore.buildModalSnapshot();
  assert.deepEqual(snapshot.entries['modal:event'], {
    open: true,
    token,
    payload: { eventId: 'e1' },
  });
  // closed subtypes are absent (presence is computed)
  assert.equal(snapshot.entries['modal:naming'], undefined);
  ModalStore.closeModal('modal:event');
});

test('openModal, updateModalPayload, and closeModal publish modal change descriptions', () => {
  resetModalStore();
  const changes = [];
  const unsubscribe = ChangeEventBus.subscribe('modal.changed', (change) => changes.push(change));
  const token = ModalStore.openModal('modal:event', { eventId: 'e2' });
  ModalStore.updateModalPayload('modal:event', { selected: true });
  ModalStore.closeModal('modal:event');
  unsubscribe();

  assert.deepEqual(changes.map(({ source, operation, subtype, token: changeToken, payload }) => ({
    source,
    operation,
    subtype,
    token: changeToken,
    payload,
  })), [
    {
      source: 'ModalStore',
      operation: 'open',
      subtype: 'modal:event',
      token,
      payload: { eventId: 'e2' },
    },
    {
      source: 'ModalStore',
      operation: 'update',
      subtype: 'modal:event',
      token,
      payload: { eventId: 'e2', selected: true },
    },
    {
      source: 'ModalStore',
      operation: 'close',
      subtype: 'modal:event',
      token,
      payload: { eventId: 'e2', selected: true },
    },
  ]);
});
