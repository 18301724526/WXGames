(function (global) {
  const DEFAULT_DIALOGUE_LEFT = 96;

  function buildDialogueLayout(options = {}) {
    const width = Number(options.width) || 0;
    const height = Number(options.height) || 0;
    const bottomSafeArea = Number(options.bottomSafeArea) || 0;
    const layout = options.layout || {};
    const dialogueLeft = Number(options.dialogueLeft) || DEFAULT_DIALOGUE_LEFT;
    const panelH = 136;
    const contentX = Number(layout.contentX) || 0;
    const contentWidth = Number(layout.contentWidth) || 0;
    const contentRight = Number(layout.contentRight) || (contentX + contentWidth);
    const panelRight = Math.min(contentRight, width - 18);
    const panelX = Math.max(contentX, Math.min(dialogueLeft, panelRight - 192));
    const panelW = Math.max(192, panelRight - panelX);
    const panelY = Math.max(84, height - panelH - 76 - bottomSafeArea);
    const portraitW = Math.min(188, Math.max(134, contentWidth * 0.42));
    const portraitH = Math.min(330, Math.max(248, height * 0.38));
    const portraitX = Math.max(contentX - 72, panelX + 12 - portraitW);
    const portraitY = Math.max(48, panelY - portraitH + 44);
    return {
      panel: { x: panelX, y: panelY, width: panelW, height: panelH },
      portrait: { x: portraitX, y: portraitY, width: portraitW, height: portraitH },
    };
  }

  const api = {
    DEFAULT_DIALOGUE_LEFT,
    buildDialogueLayout,
  };

  global.TutorialIntroDialogueLayout = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
