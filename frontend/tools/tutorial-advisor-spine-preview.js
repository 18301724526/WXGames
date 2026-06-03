(function () {
  const status = document.getElementById('status');
  const canvas = document.getElementById('advisorCanvas');

  function setStatus(message) {
    if (status) status.textContent = message;
  }

  if (!window.SpineWebglPlayer?.isAvailable?.()) {
    setStatus('加载失败：本地 Spine 3.8 WebGL runtime 不可用。');
    return;
  }

  const player = new window.SpineWebglPlayer({
    canvas,
    runtime: window,
    background: null,
    fitPadding: 1.02,
    premultipliedAlpha: false,
    onStatus(event) {
      if (event.status === 'loading') setStatus(`加载中：${event.detail}`);
      else if (event.status === 'ready') setStatus(`播放中：${event.detail}`);
      else if (event.status === 'error') setStatus(`加载失败：${event.detail}`);
    },
  });

  player.load({
    assetBase: '../assets/art/spine/tutorial/advisor/',
    jsonFile: 'tutorial_advisor.json',
    atlasFile: 'tutorial_advisor.atlas',
    animationName: 'animation',
    loop: true,
    alpha: true,
  });

  window.addEventListener('resize', () => player.resize());
  window.__tutorialAdvisorSpinePreview = player;
})();
