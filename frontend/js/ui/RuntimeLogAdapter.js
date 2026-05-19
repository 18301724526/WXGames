(function (global) {
  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[char]));
  }

  class RuntimeLogAdapter {
    constructor(options = {}) {
      this.content = options.content || null;
      this.maxItems = options.maxItems || 30;
    }

    static fromDocument(doc = document, options = {}) {
      return new RuntimeLogAdapter({
        content: doc.getElementById('logContent'),
        ...options,
      });
    }

    render(logs = []) {
      if (!this.content) return;
      const items = (logs || []).slice(0, this.maxItems);
      this.content.innerHTML = items.map((entry) => {
        const text = typeof entry === 'string' ? entry : entry?.text ?? entry?.textContent ?? '';
        return `<div class="log-item">${escapeHtml(text)}</div>`;
      }).join('');
    }
  }

  global.RuntimeLogAdapter = RuntimeLogAdapter;
  if (typeof module !== 'undefined' && module.exports) module.exports = RuntimeLogAdapter;
})(typeof window !== 'undefined' ? window : globalThis);
