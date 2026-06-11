#!/usr/bin/env node

const path = require('node:path');
const ConfigPipeline = require('../backend/services/config/ConfigPipeline');

function parseArgs(argv = []) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--json') {
      options.json = true;
      continue;
    }
    if (arg === '--baseline') {
      options.baselinePath = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg.startsWith('--baseline=')) {
      options.baselinePath = arg.slice('--baseline='.length);
      continue;
    }
    if (arg === '--write-baseline') {
      options.writeBaselinePath = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg.startsWith('--write-baseline=')) {
      options.writeBaselinePath = arg.slice('--write-baseline='.length);
    }
  }
  return options;
}

function printTextReport(report = {}) {
  const snapshot = report.current || {};
  console.log(`[config-pipeline] registries: ${snapshot.registryCount || 0}`);
  (snapshot.registries || []).forEach((registry) => {
    console.log([
      `[config-pipeline] ${registry.id}`,
      `version=${registry.version}`,
      `schema=${registry.schema}@${registry.schemaVersion}`,
      `entries=${registry.entryCount}`,
      `hash=${registry.contentHash}`,
      registry.source ? `source=${registry.source}` : '',
    ].filter(Boolean).join(' '));
  });
  if (report.comparison) {
    const comparison = report.comparison;
    console.log(`[config-pipeline] changed=${comparison.changedRegistries.length} added=${comparison.addedRegistryIds.length} removed=${comparison.removedRegistryIds.length}`);
    comparison.changedRegistries.forEach((entry) => {
      console.log([
        `[config-pipeline] diff ${entry.id}`,
        `${entry.before.version}->${entry.after.version}`,
        `contentChanged=${entry.comparison.contentChanged}`,
        `schemaChanged=${entry.comparison.schemaChanged}`,
        `addedEntries=${entry.comparison.addedEntryIds.length}`,
        `removedEntries=${entry.comparison.removedEntryIds.length}`,
        `recommended=${entry.recommendation.level}:${entry.recommendation.recommendedVersion}`,
        `ok=${entry.recommendation.versionSatisfies}`,
      ].join(' '));
    });
  }
  report.warnings.forEach((warning) => console.warn(`[config-pipeline] warning: ${warning}`));
  report.errors.forEach((error) => console.error(`[config-pipeline] error: ${error}`));
}

function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  const report = ConfigPipeline.buildPipelineReport({
    baselinePath: options.baselinePath ? path.resolve(options.baselinePath) : null,
  });

  if (options.writeBaselinePath) {
    const outputPath = path.resolve(options.writeBaselinePath);
    ConfigPipeline.writeSnapshot(outputPath, report.current);
    console.log(`[config-pipeline] wrote baseline: ${outputPath}`);
  }

  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printTextReport(report);
  }

  if (!report.success) process.exit(1);
}

if (require.main === module) {
  main();
}

module.exports = {
  parseArgs,
  printTextReport,
};
