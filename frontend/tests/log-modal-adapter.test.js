const test = require('node:test');
const assert = require('node:assert/strict');

const LogModalAdapter = require('../js/ui/LogModalAdapter');

function createClassList() {
  const classes = new Set();
  return {
    add(name) { classes.add(name); },
    remove(name) { classes.delete(name); },
    contains(name) { return classes.has(name); },
  };
}

test('log modal adapter owns H5 modal content and visibility writes', async () => {
  const modal = { style: {}, classList: createClassList() };
  const content = { innerHTML: '' };
  const adapter = new LogModalAdapter({ modal, content, activateDelayMs: 0 });

  adapter.open('<div>日志</div>');
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(content.innerHTML, '<div>日志</div>');
  assert.equal(modal.style.display, 'flex');
  assert.equal(modal.classList.contains('active'), true);

  adapter.close();

  assert.equal(modal.style.display, 'none');
  assert.equal(modal.classList.contains('active'), false);
});
