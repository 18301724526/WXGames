(function (global) {
  const STORAGE_KEY = 'tutorialIntroAdvisorSeen.v1';
  const STEPS = [
    {
      message: '前方的雾散开了。这里背山临水，土地平整，是个建立据点的好地方。',
      actionLabel: '继续',
    },
    {
      message: '让队伍入城整备。只要根基扎稳，这座首都会慢慢长成我们的核心。',
      actionLabel: '入城',
      guide: true,
    },
  ];

  class TutorialIntroOverlay {
    constructor(options = {}) {
      this.document = options.document || global.document || null;
      this.runtime = options.runtime || global;
      this.storage = options.storage || this.runtime?.localStorage || null;
      this.game = options.game || null;
      this.player = null;
      this.root = null;
      this.canvas = null;
      this.stepIndex = 0;
      this.running = false;
      this.boundHandleClick = (event) => this.handleClick(event);
    }

    static get storageKey() {
      return STORAGE_KEY;
    }

    hasSeen() {
      if (this.getQueryMode() === 'force') return false;
      return this.storage?.getItem?.(STORAGE_KEY) === 'true';
    }

    markSeen() {
      if (this.getQueryMode() === 'force') return;
      this.storage?.setItem?.(STORAGE_KEY, 'true');
    }

    getQueryMode() {
      const search = String(this.runtime?.location?.search || '');
      if (/[?&]tutorialIntro=reset(?:&|$)/.test(search)) {
        this.storage?.removeItem?.(STORAGE_KEY);
        return 'reset';
      }
      if (/[?&]tutorialIntro=1(?:&|$)/.test(search)) return 'force';
      return '';
    }

    shouldStart(state = this.game?.state) {
      if (!this.document || this.running || this.hasSeen()) return false;
      if (!state || typeof state !== 'object') return false;
      if (this.game?.authView?.loginPanelVisible || this.game?.canvasShell?.auth?.view?.loginPanelVisible) return false;
      if (!this.game?.hasServerState) return false;
      if (this.getQueryMode() === 'force') return true;
      const gameDay = Number(state.gameDay);
      const totalBuildings = Number(state.totalBuildings);
      return (!Number.isFinite(gameDay) || gameDay <= 1)
        && (!Number.isFinite(totalBuildings) || totalBuildings <= 0);
    }

    start(state = this.game?.state) {
      if (!this.shouldStart(state)) return false;
      this.running = true;
      this.stepIndex = 0;
      this.createDom();
      this.updateStep();
      this.loadSpine();
      return true;
    }

    createDom() {
      if (this.root) return this.root;
      const root = this.document.createElement('div');
      root.className = 'tutorial-intro';
      root.innerHTML = `
        <div class="tutorial-intro__scrim"></div>
        <div class="tutorial-intro__scene" aria-hidden="true">
          <div class="tutorial-intro__mist tutorial-intro__mist--a"></div>
          <div class="tutorial-intro__mist tutorial-intro__mist--b"></div>
          <div class="tutorial-intro__trail">
            <span></span><span></span><span></span><span></span>
          </div>
          <div class="tutorial-intro__capital">首都</div>
        </div>
        <section class="tutorial-intro__dialog" aria-live="polite">
          <div class="tutorial-intro__portrait">
            <canvas class="tutorial-intro__spine" aria-hidden="true"></canvas>
          </div>
          <div class="tutorial-intro__text">
            <div class="tutorial-intro__name">谋士</div>
            <p></p>
            <div class="tutorial-intro__actions">
              <button type="button" data-action="skip">跳过</button>
              <button type="button" data-action="next"></button>
            </div>
          </div>
        </section>
        <div class="tutorial-intro__finger" aria-hidden="true"></div>
      `;
      root.addEventListener('click', this.boundHandleClick);
      this.document.body.appendChild(root);
      this.root = root;
      this.canvas = root.querySelector('.tutorial-intro__spine');
      return root;
    }

    loadSpine() {
      if (!this.canvas || !global.SpineWebglPlayer?.isAvailable?.()) {
        this.root?.classList.add('tutorial-intro--fallback');
        return false;
      }
      this.player = new global.SpineWebglPlayer({
        canvas: this.canvas,
        runtime: this.runtime,
        fitPadding: 1.01,
        premultipliedAlpha: false,
      });
      return this.player.load({
        assetBase: 'assets/art/spine/tutorial/advisor/',
        jsonFile: 'tutorial_advisor.json',
        atlasFile: 'tutorial_advisor.atlas',
        animationName: 'animation',
        loop: true,
        alpha: true,
      });
    }

    updateStep() {
      if (!this.root) return;
      const step = STEPS[Math.max(0, Math.min(STEPS.length - 1, this.stepIndex))];
      const text = this.root.querySelector('.tutorial-intro__text p');
      const next = this.root.querySelector('[data-action="next"]');
      if (text) text.textContent = step.message;
      if (next) next.textContent = step.actionLabel || '继续';
      this.root.classList.toggle('tutorial-intro--guide', Boolean(step.guide));
    }

    next() {
      if (this.stepIndex < STEPS.length - 1) {
        this.stepIndex += 1;
        this.updateStep();
        return true;
      }
      this.finish({ enterCity: true });
      return true;
    }

    handleClick(event) {
      const action = event.target?.dataset?.action;
      if (!action) return;
      event.preventDefault?.();
      event.stopPropagation?.();
      if (action === 'skip') this.finish({ enterCity: false });
      if (action === 'next') this.next();
    }

    finish(options = {}) {
      this.markSeen();
      this.running = false;
      const root = this.root;
      if (root) {
        root.classList.add('tutorial-intro--closing');
        this.runtime.setTimeout?.(() => this.destroy(), 220);
      } else {
        this.destroy();
      }
      if (options.enterCity) this.openCityHud();
      return true;
    }

    openCityHud() {
      const game = this.game;
      const shell = game?.canvasShell;
      const cityId = game?.state?.cityState?.capitalCityId
        || game?.state?.activeCityId
        || game?.state?.cityState?.activeCityId
        || 'capital';
      if (game?.enterCity) {
        game.enterCity(cityId, { tab: 'buildings' });
        return true;
      }
      if (shell?.enterCity) return shell.enterCity({ cityId, tab: 'buildings' });
      return false;
    }

    destroy() {
      this.player?.dispose?.();
      this.player = null;
      if (this.root) {
        this.root.removeEventListener('click', this.boundHandleClick);
        this.root.remove();
      }
      this.root = null;
      this.canvas = null;
    }
  }

  global.TutorialIntroOverlay = TutorialIntroOverlay;
  if (typeof module !== 'undefined' && module.exports) module.exports = TutorialIntroOverlay;
})(typeof window !== 'undefined' ? window : globalThis);
