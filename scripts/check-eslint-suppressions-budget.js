const fs = require('node:fs');
const path = require('node:path');

function parseArgs(argv) {
  const options = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--current' || arg === '--generated' || arg === '--base') {
      options[arg.slice(2)] = argv[index + 1];
      index += 1;
    } else if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  return options;
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    throw new Error(`Unable to read ${filePath}: ${error.message}`);
  }
}

function getSuppressionCount(entry) {
  if (typeof entry === 'number') return entry;
  if (Array.isArray(entry)) return entry.length;
  if (entry && typeof entry.count === 'number') return entry.count;
  return 0;
}

function flattenSuppressions(suppressions) {
  const result = new Map();

  for (const [file, rules] of Object.entries(suppressions || {})) {
    for (const [rule, entry] of Object.entries(rules || {})) {
      const count = getSuppressionCount(entry);
      if (count > 0) {
        result.set(`${file}\0${rule}`, { file, rule, count });
      }
    }
  }

  return result;
}

function totalSuppressions(flattened) {
  let total = 0;
  for (const { count } of flattened.values()) {
    total += count;
  }
  return total;
}

function compareUpperBound({ label, current, upperBound }) {
  const failures = [];

  for (const { file, rule, count } of current.values()) {
    const key = `${file}\0${rule}`;
    const allowed = upperBound.get(key)?.count || 0;

    if (allowed === 0) {
      failures.push(`${label}: ${file} ${rule} is not present in the comparison baseline`);
    } else if (count > allowed) {
      failures.push(`${label}: ${file} ${rule} has ${count} suppressions, allowed ${allowed}`);
    }
  }

  return failures;
}

function printUsage() {
  console.log(`Usage: node scripts/check-eslint-suppressions-budget.js --current <file> --generated <file> [--base <file>]

Checks that the committed ESLint suppressions do not exceed the freshly generated
suppression counts. When --base is provided, also checks that the committed
baseline did not increase relative to the base branch/commit baseline.`);
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printUsage();
    return;
  }

  if (!options.current || !options.generated) {
    throw new Error('Both --current and --generated are required.');
  }

  const currentPath = path.resolve(options.current);
  const generatedPath = path.resolve(options.generated);
  const basePath = options.base ? path.resolve(options.base) : null;

  const current = flattenSuppressions(readJson(currentPath));
  const generated = flattenSuppressions(readJson(generatedPath));
  const failures = compareUpperBound({
    label: 'generated comparison',
    current,
    upperBound: generated,
  });

  if (basePath) {
    const base = flattenSuppressions(readJson(basePath));
    failures.push(
      ...compareUpperBound({
        label: 'base comparison',
        current,
        upperBound: base,
      }),
    );
    console.log(`[eslint-suppressions] base total: ${totalSuppressions(base)}`);
  }

  console.log(`[eslint-suppressions] current total: ${totalSuppressions(current)}`);
  console.log(`[eslint-suppressions] generated total: ${totalSuppressions(generated)}`);

  if (failures.length > 0) {
    console.error('[eslint-suppressions] baseline budget failed:');
    failures.forEach((failure) => console.error(`- ${failure}`));
    process.exit(1);
  }

  console.log('[eslint-suppressions] baseline budget passed');
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(`[eslint-suppressions] ${error.message}`);
    process.exit(1);
  }
}

module.exports = {
  compareUpperBound,
  flattenSuppressions,
  getSuppressionCount,
  totalSuppressions,
};
