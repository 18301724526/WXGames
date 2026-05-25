const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const TutorialCanvasRenderer = require('../js/ui/TutorialCanvasRenderer');

const projectRoot = path.join(__dirname, '..', '..');

test('tutorial canvas renderer forwards strong guide state to canvas shell', () => {
  const calls = [];
  const shell = {
    showTutorialHighlight(target, message) {
      calls.push(['show', target, message]);
    },
    hideTutorialHighlight() {
      calls.push(['hide']);
    },
  };
  const renderer = new TutorialCanvasRenderer({ canvasShell: shell });
  const target = { x: 12, y: 34, width: 100, height: 40 };

  renderer.show(target, 'Advance now');
  renderer.hide();

  assert.deepEqual(calls, [
    ['show', target, 'Advance now'],
    ['hide'],
  ]);
  assert.equal(renderer.activeTarget, null);
  assert.equal(renderer.activeMessage, '');
});

test('soft guide clears canvas highlight and updates advisor advice only', () => {
  const calls = [];
  const renderer = new TutorialCanvasRenderer({
    canvasShell: {
      hideTutorialHighlight() {
        calls.push('hide');
      },
    },
  });
  let advisorMessage = '';
  renderer.onSoftGuide = (message) => {
    advisorMessage = message;
  };

  renderer.showSoft('Wait for enough resources');

  assert.deepEqual(calls, ['hide']);
  assert.equal(advisorMessage, 'Wait for enough resources');
});

test('guide task takeover does not clear guide-owned canvas highlight', () => {
  const calls = [];
  const renderer = new TutorialCanvasRenderer({
    canvasShell: {
      tutorialHighlight: { source: 'guide' },
      hideTutorialHighlight() {
        calls.push('hide');
      },
    },
  });

  assert.equal(renderer.clearOwnedHighlight(), false);
  assert.deepEqual(calls, []);
});

test('tutorial renderer source has no DOM coupling', () => {
  const source = fs.readFileSync(path.join(projectRoot, 'frontend', 'js', 'ui', 'TutorialCanvasRenderer.js'), 'utf8');

  assert.doesNotMatch(source, /document|getElementById|querySelector|classList|style\.|textContent|addEventListener|scrollIntoView/);
});
