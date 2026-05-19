const test = require('node:test');
const assert = require('node:assert/strict');

const RuntimeLogAdapter = require('../js/ui/RuntimeLogAdapter');

test('runtime log adapter renders bounded H5 log entries from plain data', () => {
  const content = { innerHTML: '' };
  const adapter = new RuntimeLogAdapter({ content, maxItems: 2 });

  adapter.render([
    { text: '<first>' },
    'second',
    { text: 'third' },
  ]);

  assert.equal(
    content.innerHTML,
    '<div class="log-item">&lt;first&gt;</div><div class="log-item">second</div>',
  );
});
