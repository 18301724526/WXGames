// ==================== 飘字动画模块 ====================
// 解耦提取：showFloatingText 独立为可复用模块
// 由 app.js init() 调用 window.mountFloatingText(game) 挂载

window.mountFloatingText = function(game) {
    /**
     * 在指定元素上方显示飘字动画
     * @param {string} text - 飘字内容（如 '🌾 +10'）
     * @param {string} selector - 目标元素的 CSS 选择器（如 '.food-card'）
     * @param {string} color - 文字颜色，默认 '#4ecca3'
     */
    game.showFloatingText = function(text, selector, color = '#4ecca3') {
        const container = document.querySelector(selector);
        if (!container) return;

        const rect = container.getBoundingClientRect();
        const fxLayer = document.getElementById('fxLayer');
        if (!fxLayer) return;

        const el = document.createElement('div');
        el.className = 'floating-text';
        el.textContent = text;
        el.style.color = color;
        el.style.left = `${rect.left + rect.width / 2}px`;
        el.style.top = `${rect.top}px`;
        fxLayer.appendChild(el);
        setTimeout(() => el.remove(), 1200);
    };

    console.log('[floating-text.js] 飘字动画模块已挂载');
};
