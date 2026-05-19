const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const H5TutorialStorageAdapter = require('../js/ui/H5TutorialStorageAdapter');

const projectRoot = path.join(__dirname, '..', '..');

function createStorage(initial = {}) {
  const store = new Map(Object.entries(initial));
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
  };
}

test('H5 tutorial storage adapter owns local tutorial progress flags', () => {
  const storage = createStorage({ tutorialAutoStarted: 'true' });
  const adapter = H5TutorialStorageAdapter.fromStorage(storage);

  assert.equal(adapter.isAutoStarted(), true);

  adapter.setProgress({ completed: false, currentStep: 7 });
  adapter.setAutoStarted(false);

  assert.equal(storage.getItem('tutorialCompleted'), 'false');
  assert.equal(storage.getItem('tutorialStep'), '7');
  assert.equal(storage.getItem('tutorialAutoStarted'), null);

  adapter.setAutoStarted(true);
  adapter.clear();

  assert.equal(storage.getItem('tutorialAutoStarted'), null);
  assert.equal(storage.getItem('tutorialStep'), null);
  assert.equal(storage.getItem('tutorialCompleted'), null);
});

test('tutorial controller and app delegate local storage to H5 tutorial storage adapter', () => {
  const html = fs.readFileSync(path.join(projectRoot, 'frontend', 'index.html'), 'utf8');
  const appJs = fs.readFileSync(path.join(projectRoot, 'frontend', 'app.js'), 'utf8');
  const controllerJs = fs.readFileSync(path.join(projectRoot, 'frontend', 'js', 'controllers', 'TutorialController.js'), 'utf8');

  assert.match(html, /js\/ui\/H5TutorialStorageAdapter\.js\?v=h5-tutorial-storage-v1/);
  assert.match(html, /H5TutorialStorageAdapter\.js\?v=h5-tutorial-storage-v1[\s\S]*H5ShellAdapter\.js\?v=sync-scheduler-v1[\s\S]*TutorialController\.js\?v=h5-tutorial-storage-v1[\s\S]*app\.js\?v=sync-scheduler-v1/);
  assert.match(appJs, /storage: this\.tutorialStorage/);
  assert.match(controllerJs, /this\.storage = options\.storage/);
  assert.doesNotMatch(controllerJs, /\blocalStorage\b|getItem\('tutorialAutoStarted'|setItem\('tutorial|removeItem\('tutorial/);
});
