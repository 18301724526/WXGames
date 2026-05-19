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

test('runtime log adapter can collect its H5 content node from document', () => {
  const content = { innerHTML: '' };
  const adapter = RuntimeLogAdapter.fromDocument({
    getElementById(id) {
      return id === 'logContent' ? content : null;
    },
  }, { maxItems: 1 });

  adapter.render(['first', 'second']);

  assert.equal(adapter.content, content);
  assert.equal(content.innerHTML, '<div class="log-item">first</div>');
});
