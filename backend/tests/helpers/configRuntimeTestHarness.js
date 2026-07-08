const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ConfigPipeline = require('../../services/config/ConfigPipeline');
const ConfigReleaseService = require('../../services/config/ConfigReleaseService');
const GameplayConfigRuntime = require('../../services/config/GameplayConfigRuntime');

function createTempReleasePaths(prefix = 'wxgame-config-runtime-test-') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  return {
    dir,
    historyPath: path.join(dir, 'configReleases.json'),
    activePath: path.join(dir, 'configActiveRelease.json'),
  };
}

function publishCurrentConfigRuntime(options = {}) {
  const paths = createTempReleasePaths(options.prefix);
  const generatedAt = options.generatedAt || '2026-07-08T00:00:00.000Z';
  const now = options.now || new Date(generatedAt);
  const snapshot = ConfigPipeline.buildCurrentSnapshot({
    ...options,
    generatedAt,
  });
  const publish = ConfigReleaseService.publishRelease(
    { snapshot, source: options.source || 'unit:current-config' },
    {
      ...paths,
      ...options,
      operator: options.operator || 'unit-test',
      now,
    },
  );
  if (!publish.success) {
    throw new Error(`Failed to publish test config runtime: ${(publish.errors || []).join('; ')}`);
  }
  GameplayConfigRuntime.resetRuntimeConfig();
  GameplayConfigRuntime.configureRuntimeConfig({
    ...paths,
    env: options.env || { NODE_ENV: 'production' },
    now,
  });
  GameplayConfigRuntime.initializeRuntimeConfig();
  return { ...paths, snapshot, publish };
}

function resetConfigRuntime() {
  GameplayConfigRuntime.resetRuntimeConfig();
}

module.exports = {
  createTempReleasePaths,
  publishCurrentConfigRuntime,
  resetConfigRuntime,
};
