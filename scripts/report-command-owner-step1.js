'use strict';

const {
  REPORT_NAME,
  buildReport,
  parseArgs,
  renderMarkdown,
  renderSummary,
} = require('./command-owner-step1');

function main() {
  try {
    const { format } = parseArgs();
    const report = buildReport();
    if (format === 'json') process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    else if (format === 'markdown') process.stdout.write(renderMarkdown(report));
    else process.stdout.write(renderSummary(report));
  } catch (error) {
    console.error(`[${REPORT_NAME}] failed: ${error.message}`);
    process.exit(1);
  }
}

if (require.main === module) main();

module.exports = require('./command-owner-step1');
