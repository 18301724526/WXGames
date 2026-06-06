(function (global) {
  const BUTTON_ID = 'debugResetCurrentAccountButton';
  const READY_TEXT = '重置账号';
  const BUSY_TEXT = '重置中';

  function getFrameRect(runtime = global) {
    const viewportWidth = Math.max(1, Number(runtime.innerWidth) || 1);
    const viewportHeight = Math.max(1, Number(runtime.innerHeight) || 1);
    const frameWidth = Math.min(viewportWidth, viewportHeight * 9 / 16);
    const frameHeight = Math.min(viewportHeight, viewportWidth * 16 / 9);
    return {
      x: (viewportWidth - frameWidth) / 2,
      y: (viewportHeight - frameHeight) / 2,
      width: frameWidth,
      height: frameHeight,
      viewportWidth,
      viewportHeight,
    };
  }

  function applyButtonStyle(button) {
    Object.assign(button.style, {
      position: 'fixed',
      minWidth: '76px',
      height: '34px',
      padding: '0 10px',
      border: '1px solid rgba(255, 216, 138, 0.62)',
      borderRadius: '8px',
      background: 'rgba(72, 24, 22, 0.92)',
      color: '#ffe5b0',
      fontSize: '12px',
      fontWeight: '700',
      lineHeight: '32px',
      textAlign: 'center',
      boxShadow: '0 8px 24px rgba(0, 0, 0, 0.34)',
      cursor: 'pointer',
      pointerEvents: 'auto',
      userSelect: 'none',
      zIndex: '2147483647',
    });
  }

  function positionButton(button, runtime = global) {
    if (!button?.style) return false;
    const frame = getFrameRect(runtime);
    const frameRight = frame.x + frame.width;
    const gutter = frame.viewportWidth - frameRight;
    button.style.top = `${Math.max(12, Math.round(frame.y + 68))}px`;
    if (gutter >= 96) {
      button.style.left = `${Math.round(frameRight + 10)}px`;
      button.style.right = 'auto';
    } else {
      button.style.left = 'auto';
      button.style.right = '10px';
    }
    return true;
  }

  function getGame(runtime = global) {
    return runtime.Game || runtime.game || null;
  }

  function alertMessage(runtime, message) {
    if (typeof runtime?.alert === 'function') runtime.alert(message);
  }

  async function handleReset(runtime = global, button = null) {
    const game = getGame(runtime);
    if (!game?.token) {
      alertMessage(runtime, '请先登录后再重置当前账号');
      return false;
    }
    if (typeof game.resetGame !== 'function') {
      alertMessage(runtime, '当前页面未挂载重置能力');
      return false;
    }
    if (button) {
      button.disabled = true;
      button.textContent = BUSY_TEXT;
      button.style.opacity = '0.72';
      button.style.cursor = 'wait';
    }
    try {
      return Boolean(await game.resetGame());
    } catch (error) {
      const message = error?.payload?.message || error?.message || '请求失败';
      console.error('[debug-reset] reset failed', error);
      alertMessage(runtime, `重置失败：${message}`);
      return false;
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = READY_TEXT;
        button.style.opacity = '1';
        button.style.cursor = 'pointer';
      }
    }
  }

  function createButton(doc, runtime = global) {
    const button = doc.createElement('button');
    button.id = BUTTON_ID;
    button.type = 'button';
    button.className = 'debug-reset-account-button';
    button.textContent = READY_TEXT;
    button.title = '临时调试：重置当前账号';
    button.setAttribute?.('aria-label', '重置当前账号');
    button.setAttribute?.('data-debug-reset-account', 'true');
    applyButtonStyle(button);
    positionButton(button, runtime);
    button.addEventListener?.('click', () => handleReset(runtime, button));
    doc.body.appendChild(button);
    return button;
  }

  function mount(runtime = global) {
    const doc = runtime.document || null;
    if (!doc?.body || typeof doc.createElement !== 'function') return null;
    const existing = doc.getElementById?.(BUTTON_ID) || null;
    const button = existing || createButton(doc, runtime);
    positionButton(button, runtime);
    if (!button._debugResetResizeBound && typeof runtime.addEventListener === 'function') {
      const resizeHandler = () => positionButton(button, runtime);
      runtime.addEventListener('resize', resizeHandler);
      button._debugResetResizeBound = true;
    }
    return button;
  }

  function autoMount(runtime = global) {
    const doc = runtime.document || null;
    if (!doc?.addEventListener) return mount(runtime);
    if (doc.readyState && doc.readyState !== 'loading') return mount(runtime);
    doc.addEventListener('DOMContentLoaded', () => mount(runtime), { once: true });
    return null;
  }

  const api = {
    BUTTON_ID,
    READY_TEXT,
    BUSY_TEXT,
    getFrameRect,
    positionButton,
    handleReset,
    mount,
    autoMount,
  };

  global.H5DebugResetButton = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') autoMount(global);
})(typeof window !== 'undefined' ? window : globalThis);
