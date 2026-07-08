const test = require('node:test');
const assert = require('node:assert/strict');

require('../config/LocaleTextRegistry');
const LocaleText = require('../ecs/resource/LocaleText');
const H5UpdateRuntimeAdapter = require('./H5UpdateRuntimeAdapter');

test('H5UpdateRuntimeAdapter preserves world march trace through forced reload URLs', () => {
  const adapter = new H5UpdateRuntimeAdapter({}, {
    location: { href: 'http://47.116.32.216/?worldMarchTrace=1' },
    URL,
    now: () => 1780839647499,
  });

  const nextUrl = new URL(adapter.buildReloadUrl());
  assert.equal(nextUrl.searchParams.get('worldMarchTrace'), '1');
  assert.equal(nextUrl.searchParams.get('reload'), '1780839647499');
});

test('H5UpdateRuntimeAdapter normalizes trace aliases when rebuilding reload URLs', () => {
  const adapter = new H5UpdateRuntimeAdapter({}, {
    location: { href: 'http://47.116.32.216/?codexTrace=1&foo=bar' },
    URL,
    now: () => 1780839647500,
  });

  const nextUrl = new URL(adapter.buildReloadUrl());
  assert.equal(nextUrl.searchParams.get('worldMarchTrace'), '1');
  assert.equal(nextUrl.searchParams.get('codexTrace'), '1');
  assert.equal(nextUrl.searchParams.get('foo'), 'bar');
  assert.equal(nextUrl.searchParams.get('reload'), '1780839647500');
});

test('H5UpdateRuntimeAdapter resolves update message through active locale', () => {
  LocaleText.setLocale('en-US');
  const adapter = new H5UpdateRuntimeAdapter({}, {});

  assert.equal(
    adapter.buildMessage({
      serverVersion: '2.0.0',
      localVersion: '1.9.0',
      serverDeploymentId: 'abcdef1234567890',
      localDeploymentId: '123456abcdef7890',
    }),
    [
      'A game update is available. Restart to continue.',
      'Server version: 2.0.0',
      'Local version: 1.9.0',
      'Server deployment: abcdef123456',
      'Local deployment: 123456abcdef',
    ].join('\n'),
  );
  LocaleText.setLocale('zh-CN');
});

test('H5UpdateRuntimeAdapter reports deploy failure without forcing reload', () => {
  LocaleText.setLocale('en-US');
  const calls = [];
  const adapter = new H5UpdateRuntimeAdapter({}, {
    confirm(message) {
      calls.push(['confirm', message]);
    },
    location: {
      href: 'http://47.116.32.216/',
      replace(url) {
        calls.push(['replace', url]);
      },
    },
    URL,
  });

  const message = adapter.notifyDeployFailure({
    deployStatus: {
      targetCommit: 'abcdef1234567890',
      stage: 'deploy-gate',
      logPath: '/opt/wxgame-refactor/.wxgame/push-deploy.log',
      recentLogLines: ['older line', 'npm test failed at architecture gate'],
      error: { message: 'npm test failed' },
    },
  });

  assert.equal(message, [
    'Deployment failed. The game is still using the previous version.',
    'Target commit: abcdef123456',
    'Failed stage: deploy-gate',
    'Error: npm test failed',
    'Server log: /opt/wxgame-refactor/.wxgame/push-deploy.log',
    'Recent log: npm test failed at architecture gate',
  ].join('\n'));
  assert.deepEqual(calls, [['confirm', message]]);
  LocaleText.setLocale('zh-CN');
});
