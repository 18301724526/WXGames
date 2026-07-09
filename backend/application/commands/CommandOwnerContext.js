'use strict';

const { AsyncLocalStorage } = require('node:async_hooks');

const ownerContextStorage = new AsyncLocalStorage();

class CommandOwnerContextError extends Error {
  constructor(code, message, detail = {}) {
    super(message);
    this.name = 'CommandOwnerContextError';
    this.code = code;
    this.status = 500;
    Object.assign(this, detail);
  }
}

function runWithOwnerContext(context = {}, callback) {
  if (typeof callback !== 'function') throw new Error('runWithOwnerContext requires callback');
  const ownerKeys = Array.isArray(context.ownerKeys) ? [...context.ownerKeys] : [];
  const value = Object.freeze({
    schema: 'command-owner-context-v1',
    ownerKey: String(context.ownerKey || '').trim(),
    ownerKeys: Object.freeze(ownerKeys),
    scope: String(context.scope || '').trim(),
    commandId: String(context.commandId || '').trim(),
    lock: context.lock || null,
  });
  if (!value.ownerKey || !value.ownerKeys.includes(value.ownerKey)) {
    throw new CommandOwnerContextError(
      'OWNER_CONTEXT_INVALID',
      'Owner context requires a primary owner included in ownerKeys',
    );
  }
  return ownerContextStorage.run(value, callback);
}

function getOwnerContext() {
  return ownerContextStorage.getStore() || null;
}

function requireOwnerContext(expected = {}) {
  const context = getOwnerContext();
  if (!context) {
    throw new CommandOwnerContextError(
      'OWNER_CONTEXT_REQUIRED',
      'Domain execution requires a pipeline-owned owner context',
    );
  }
  const expectedOwnerKey = String(expected.ownerKey || '').trim();
  if (expectedOwnerKey && context.ownerKey !== expectedOwnerKey) {
    throw new CommandOwnerContextError(
      'OWNER_CONTEXT_MISMATCH',
      `Expected owner ${expectedOwnerKey}, received ${context.ownerKey}`,
      { expectedOwnerKey, actualOwnerKey: context.ownerKey },
    );
  }
  const expectedOwnerKeys = Array.isArray(expected.ownerKeys) ? expected.ownerKeys : [];
  const missingOwnerKeys = expectedOwnerKeys.filter((ownerKey) => !context.ownerKeys.includes(ownerKey));
  if (missingOwnerKeys.length > 0) {
    throw new CommandOwnerContextError(
      'OWNER_CONTEXT_KEYS_MISSING',
      `Owner context is missing keys: ${missingOwnerKeys.join(', ')}`,
      { missingOwnerKeys },
    );
  }
  return context;
}

module.exports = {
  CommandOwnerContextError,
  getOwnerContext,
  requireOwnerContext,
  runWithOwnerContext,
};
