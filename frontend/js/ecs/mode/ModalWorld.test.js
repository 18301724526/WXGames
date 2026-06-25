const test = require('node:test');
const assert = require('node:assert/strict');

const ModalWorld = require('./ModalWorld');

test('createModalWorld returns a frozen empty world', () => {
  const world = ModalWorld.createModalWorld();
  assert.equal(Object.isFrozen(world), true);
  assert.deepEqual(world.entries, {});
  assert.equal(world.tokenSeq, 0);
});

test('openModal sets presence, a deterministic token, and a frozen payload', () => {
  const world = ModalWorld.openModal(ModalWorld.createModalWorld(), 'modal:naming', {
    visible: true,
    inputValue: 'a',
  });
  assert.equal(ModalWorld.isModalOpen(world, 'modal:naming'), true);
  assert.equal(ModalWorld.getModalToken(world, 'modal:naming'), 'modal:naming#1');
  assert.deepEqual(ModalWorld.getModalPayload(world, 'modal:naming'), {
    visible: true,
    inputValue: 'a',
  });
  assert.equal(Object.isFrozen(ModalWorld.getModalPayload(world, 'modal:naming')), true);
});

test('openModal is immutable and mints incrementing tokens', () => {
  const w0 = ModalWorld.createModalWorld();
  const w1 = ModalWorld.openModal(w0, 'modal:naming', {});
  const w2 = ModalWorld.openModal(w1, 'modal:naming', {});
  assert.equal(w0.tokenSeq, 0); // original untouched
  assert.equal(ModalWorld.getModalToken(w1, 'modal:naming'), 'modal:naming#1');
  assert.equal(ModalWorld.getModalToken(w2, 'modal:naming'), 'modal:naming#2');
});

test('updateModalPayload patches an open modal and no-ops on a closed one', () => {
  const open = ModalWorld.openModal(ModalWorld.createModalWorld(), 'modal:naming', {
    inputValue: '',
  });
  const patched = ModalWorld.updateModalPayload(open, 'modal:naming', {
    inputValue: 'hi',
    submitting: true,
  });
  assert.deepEqual(ModalWorld.getModalPayload(patched, 'modal:naming'), {
    inputValue: 'hi',
    submitting: true,
  });
  assert.equal(ModalWorld.getModalToken(patched, 'modal:naming'), 'modal:naming#1'); // token preserved

  const closed = ModalWorld.closeModal(open, 'modal:naming');
  const afterNoop = ModalWorld.updateModalPayload(closed, 'modal:naming', { inputValue: 'x' });
  assert.equal(ModalWorld.isModalOpen(afterNoop, 'modal:naming'), false);
});

test('closeModal clears presence, payload, and token', () => {
  const open = ModalWorld.openModal(ModalWorld.createModalWorld(), 'modal:naming', {
    visible: true,
  });
  const closed = ModalWorld.closeModal(open, 'modal:naming');
  assert.equal(ModalWorld.isModalOpen(closed, 'modal:naming'), false);
  assert.equal(ModalWorld.getModalPayload(closed, 'modal:naming'), null);
  assert.equal(ModalWorld.getModalToken(closed, 'modal:naming'), '');
});

test('unknown subtype reads are inert', () => {
  const world = ModalWorld.createModalWorld();
  assert.equal(ModalWorld.isModalOpen(world, 'modal:event'), false);
  assert.equal(ModalWorld.getModalPayload(world, 'modal:event'), null);
});
