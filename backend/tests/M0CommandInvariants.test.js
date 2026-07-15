'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  inspectDocument,
  splitTableRow,
} = require('../../scripts/m0-writer-inventory/check-invariants');

const DOCUMENT_PATH = path.resolve(__dirname, '..', '..', 'docs', 'architecture', 'm0', 'command-invariants.md');

function readDocument() {
  return fs.readFileSync(DOCUMENT_PATH, 'utf8');
}

function mutateCommandRow(markdown, commandType, mutateCells) {
  return markdown.split(/\r?\n/).map((line) => {
    if (!line.startsWith(`| ${commandType} |`)) return line;
    const cells = splitTableRow(line);
    mutateCells(cells);
    return `| ${cells.join(' | ')} |`;
  }).join('\n');
}

test('M0 command invariant document covers the complete owner registry and six critical paths', () => {
  const result = inspectDocument(readDocument());

  assert.equal(result.summary.registryCommandCount, 44);
  assert.equal(result.summary.documentedCommandCount, 44);
  assert.equal(result.summary.criticalPathCount, 6);
  assert.deepEqual(result.findings, []);
});

test('M0 command invariant guard fails when a registered command row is missing', () => {
  const markdown = readDocument().split(/\r?\n/)
    .filter((line) => !line.startsWith('| build |'))
    .join('\n');

  assert.equal(
    inspectDocument(markdown).findings.includes('registry command missing from document: build'),
    true,
  );
});

test('M0 command invariant guard fails when any required field is empty', () => {
  const markdown = mutateCommandRow(readDocument(), 'research', (cells) => {
    cells[3] = '';
  });

  assert.equal(
    inspectDocument(markdown).findings.includes('research field is empty: domainTables'),
    true,
  );
});

test('M0 command invariant guard verifies owner rules instead of command names only', () => {
  const markdown = mutateCommandRow(readDocument(), 'startWorldMarch', (cells) => {
    cells[2] = 'player:{playerId}';
  });

  assert.equal(
    inspectDocument(markdown).findings.some((finding) => finding.startsWith('startWorldMarch ownerSet mismatch')),
    true,
  );
});

test('M0 command invariant guard requires an explicit invariant for absent critical paths', () => {
  const markdown = readDocument().split(/\r?\n/)
    .filter((line) => !line.startsWith('| 付费 |'))
    .join('\n');

  assert.equal(
    inspectDocument(markdown).findings.includes('critical path lacks tagged command or absent declaration: 付费'),
    true,
  );
});
