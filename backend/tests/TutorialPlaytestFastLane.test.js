const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  Database,
  createSqliteCheckpoint,
  restoreSqliteCheckpoint,
} = require('../../scripts/tutorial-playtest-checkpoint');
const {
  TutorialPlaytestSoftLoopGuard,
} = require('../../scripts/tutorial-playtest-soft-loop');

test('soft-loop trips on the eighth consecutive same-label no-progress action', () => {
  const guard = new TutorialPlaytestSoftLoopGuard({ threshold: 8 });
  let observation = null;
  for (let count = 1; count <= 8; count += 1) {
    observation = guard.observe({
      label: 'open-task-center',
      beforeStep: 12,
      afterStep: 12,
      highlight: { allowedAction: { type: 'openTaskCenter' } },
    });
    assert.equal(observation.count, count);
    assert.equal(observation.triggered, count === 8);
  }
  assert.deepEqual(observation.highlight, {
    allowedAction: { type: 'openTaskCenter' },
  });
});

test('soft-loop counter resets when the label changes or the step advances', () => {
  const guard = new TutorialPlaytestSoftLoopGuard({ threshold: 2 });
  guard.observe({ label: 'first', beforeStep: 4, afterStep: 4 });
  const changedLabel = guard.observe({ label: 'second', beforeStep: 4, afterStep: 4 });
  assert.equal(changedLabel.count, 1);
  assert.equal(changedLabel.triggered, false);

  const advanced = guard.observe({ label: 'second', beforeStep: 4, afterStep: 5 });
  assert.equal(advanced.count, 0);
  assert.equal(advanced.triggered, false);

  const restarted = guard.observe({ label: 'second', beforeStep: 5, afterStep: 5 });
  assert.equal(restarted.count, 1);
});

test('sqlite checkpoint captures a live WAL database and restores it into a fresh path', async (t) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tutorial-playtest-checkpoint-'));
  t.after(() => fs.rmSync(tempDir, { recursive: true, force: true }));
  const sourcePath = path.join(tempDir, 'source.db');
  const checkpointPath = path.join(tempDir, 'checkpoints', 'step-12.db');
  const restoredPath = path.join(tempDir, 'restored.db');

  const source = new Database(sourcePath);
  source.pragma('journal_mode = WAL');
  source.exec('CREATE TABLE progress (step INTEGER NOT NULL, label TEXT NOT NULL)');
  source.prepare('INSERT INTO progress (step, label) VALUES (?, ?)').run(12, 'checkpoint');

  const checkpoint = await createSqliteCheckpoint({
    sourcePath,
    checkpointPath,
    metadata: { step: 12 },
  });
  source.close();

  assert.equal(checkpoint.metadata.step, 12);
  assert.equal(fs.existsSync(checkpointPath), true);
  assert.equal(fs.existsSync(checkpoint.manifestPath), true);

  const restored = restoreSqliteCheckpoint({ checkpointPath, targetPath: restoredPath });
  assert.equal(restored.targetPath, restoredPath);
  const db = new Database(restoredPath, { readonly: true });
  try {
    assert.deepEqual(db.prepare('SELECT step, label FROM progress').get(), {
      step: 12,
      label: 'checkpoint',
    });
  } finally {
    db.close();
  }
});

test('checkpoint restore refuses to overwrite an existing database by default', async (t) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tutorial-playtest-restore-'));
  t.after(() => fs.rmSync(tempDir, { recursive: true, force: true }));
  const sourcePath = path.join(tempDir, 'source.db');
  const checkpointPath = path.join(tempDir, 'checkpoint.db');
  const targetPath = path.join(tempDir, 'target.db');

  const source = new Database(sourcePath);
  source.exec('CREATE TABLE marker (value TEXT NOT NULL)');
  source.close();
  await createSqliteCheckpoint({ sourcePath, checkpointPath });
  fs.copyFileSync(checkpointPath, targetPath);

  assert.throws(
    () => restoreSqliteCheckpoint({ checkpointPath, targetPath }),
    /restore target already exists/,
  );
});
