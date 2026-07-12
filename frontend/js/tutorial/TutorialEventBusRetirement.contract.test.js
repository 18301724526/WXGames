const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '../../..');
const platformRoot = path.join(repoRoot, 'frontend/js/platform');

function collectProductionJs(directory, files = []) {
  fs.readdirSync(directory, { withFileTypes: true }).forEach((entry) => {
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory()) collectProductionJs(filePath, files);
    else if (entry.name.endsWith('.js') && !entry.name.endsWith('.test.js')) files.push(filePath);
  });
  return files;
}

test('tutorial event delivery has one bus source and no wrapper topic', () => {
  const registrySource = fs.readFileSync(path.join(__dirname, 'TutorialGuideEventRegistry.js'), 'utf8');
  const hostSource = fs.readFileSync(path.join(__dirname, 'TutorialHostContext.js'), 'utf8');

  assert.equal(registrySource.includes('tutorial.event'), false);
  assert.equal(registrySource.includes('recentDispatches'), false);
  assert.match(hostSource, /this\.changeEventBus\?\.emit\?\.\(eventName, payload\)/);
});

test('non-tutorial platform sources only allow the settled event-action refresh', () => {
  const sources = collectProductionJs(platformRoot)
    .filter((filePath) => !path.basename(filePath).startsWith('CanvasPanelActionRunner'))
    .map((filePath) => ({ filePath, source: fs.readFileSync(filePath, 'utf8') }));
  const pokeViolations = sources.filter(({ filePath, source }) => {
    const count = (source.match(/refreshCurrentHighlight/g) || []).length;
    const allowed = path.basename(filePath) === 'CanvasActionController.js' ? 1 : 0;
    return count !== allowed;
  });
  const onXxxFiles = sources.filter(({ source }) => /tutorialController\?\.on[A-Z]/.test(source));

  assert.deepEqual(pokeViolations.map(({ filePath }) => path.relative(repoRoot, filePath)), []);
  assert.deepEqual(onXxxFiles.map(({ filePath }) => path.relative(repoRoot, filePath)), []);
});

test('frozen CanvasPanelActionRunner keeps exactly three declared poke references', () => {
  const source = fs.readFileSync(path.join(platformRoot, 'CanvasPanelActionRunner.js'), 'utf8');
  assert.equal((source.match(/refreshCurrentHighlight/g) || []).length, 3);
});
