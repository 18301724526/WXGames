(function (global) {
  function buildFont(options = {}) {
    return `${options.bold ? '700 ' : ''}${options.size || 14}px ${options.fontFamily || 'sans-serif'}`;
  }

  function withFont(ctx, options, callback) {
    const previousFont = ctx.font;
    ctx.font = buildFont(options);
    try {
      return callback();
    } finally {
      ctx.font = previousFont;
    }
  }

  function measureTextWidth(ctx, text, options = {}) {
    const content = String(text ?? '');
    if (!ctx || typeof ctx.measureText !== 'function') return content.length * (options.size || 14) * 0.55;
    return withFont(ctx, options, () => ctx.measureText(content).width);
  }

  function wrapText(ctx, text, maxWidth, options = {}) {
    const content = String(text ?? '');
    if (!content) return [];
    if (!ctx || typeof ctx.measureText !== 'function') return [content];
    return withFont(ctx, options, () => {
      const lines = [];
      content.split('\n').forEach((rawLine) => {
        let buffer = '';
        Array.from(rawLine).forEach((char) => {
          const next = `${buffer}${char}`;
          if (buffer && ctx.measureText(next).width > maxWidth) {
            lines.push(buffer);
            buffer = char;
          } else {
            buffer = next;
          }
        });
        if (buffer || rawLine === '') lines.push(buffer);
      });
      return lines;
    });
  }

  function truncateText(ctx, text, maxWidth, options = {}) {
    const content = String(text ?? '');
    if (!content || measureTextWidth(ctx, content, options) <= maxWidth) return content;
    const ellipsis = '...';
    let buffer = '';
    Array.from(content).some((char) => {
      const next = `${buffer}${char}`;
      if (measureTextWidth(ctx, `${next}${ellipsis}`, options) > maxWidth) return true;
      buffer = next;
      return false;
    });
    return buffer ? `${buffer}${ellipsis}` : ellipsis;
  }

  function wrapTextLimit(ctx, text, maxWidth, maxLines, options = {}) {
    const limit = Math.max(1, Number(maxLines) || 1);
    const lines = wrapText(ctx, text, maxWidth, options);
    if (lines.length <= limit) return lines;
    const visible = lines.slice(0, limit);
    visible[visible.length - 1] = truncateText(ctx, `${visible[visible.length - 1]}...`, maxWidth, options);
    return visible;
  }

  const api = {
    buildFont,
    measureTextWidth,
    truncateText,
    wrapText,
    wrapTextLimit,
  };

  global.CanvasSurfaceTextLayout = api;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
