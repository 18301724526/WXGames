(function (global) {
  class TutorialController {
    constructor(options) {
      this.api = options.api;
      this.renderer = options.renderer;
      this.getTarget = options.getTarget;
      this.onTabLockChange = options.onTabLockChange;
      this.state = { completed: false, currentStep: 0 };
      this.autoStarted = localStorage.getItem('tutorialAutoStarted') === 'true';
    }

    syncLocalProgress() {
      localStorage.setItem('tutorialCompleted', this.state.completed ? 'true' : 'false');
      localStorage.setItem('tutorialStep', String(this.state.currentStep));
    }

    syncAutoStartedFlag() {
      if (this.state.completed || this.state.currentStep > 0) {
        this.autoStarted = true;
        localStorage.setItem('tutorialAutoStarted', 'true');
        return;
      }
      // 服务端返回 step 0 时，以服务端为准重新允许自动启动。
      this.autoStarted = false;
      localStorage.removeItem('tutorialAutoStarted');
    }

    setState(tutorial) {
      this.state = tutorial || { completed: false, currentStep: 0 };
      this.syncLocalProgress();
      this.syncAutoStartedFlag();
      this.render();
      if (!this.state.completed && this.state.currentStep === 0 && !this.autoStarted) {
        this.autoStarted = true;
        localStorage.setItem('tutorialAutoStarted', 'true');
        setTimeout(() => this.advanceTo(1).catch((error) => {
          console.warn('[tutorial] auto start failed:', error);
          this.autoStarted = false;
          localStorage.removeItem('tutorialAutoStarted');
        }), global.GameConfig.TUTORIAL_START_DELAY_MS);
      }
    }

    async advanceTo(step) {
      if (this.state.completed || step <= this.state.currentStep) return;
      const data = await this.api.advanceTutorial(step);
      this.state = data.tutorial || { completed: step >= 7, currentStep: step };
      this.syncLocalProgress();
      this.syncAutoStartedFlag();
      this.render();
    }

    async onTabClicked(tabId) {
      if (this.state.completed) return true;
      if (!this.canOpenTab(tabId)) return false;
      if (this.state.currentStep === 1 && tabId === 'civilization') {
        await this.advanceTo(2);
      } else if (this.state.currentStep === 4 && tabId === 'buildings') {
        await this.advanceTo(5);
      }
      return true;
    }

    notifyEraAdvanced(remoteTutorial) {
      this.state = remoteTutorial || { completed: false, currentStep: 4 };
      this.render();
    }

    notifyFarmBuilt(remoteTutorial) {
      this.state = remoteTutorial || { completed: true, currentStep: 7 };
      this.syncLocalProgress();
      this.syncAutoStartedFlag();
      this.render();
    }

    canOpenTab(tabId) {
      if (this.state.completed) return true;
      const step = this.state.currentStep;
      if (step <= 1) return ['resources', 'civilization'].includes(tabId);
      if (step <= 3) return tabId === 'civilization';
      if (step === 4) return ['civilization', 'buildings'].includes(tabId);
      if (step <= 6) return tabId === 'buildings';
      return true;
    }

    getMessage() {
      const step = this.state.currentStep;
      if (step === 1) return '点击这里，查看文明进展';
      if (step === 2) return '食物足够了！进阶到农耕时代';
      if (step === 4) return '新时代解锁了建筑！';
      if (step === 5) return '建造第一座农田';
      if (step === 7) return '引导完成！自由发展吧';
      return '';
    }

    getTargetKey() {
      const step = this.state.currentStep;
      if (step === 1) return 'tab-civilization';
      if (step === 2) return 'btn-advance-era';
      if (step === 4) return 'tab-buildings';
      if (step === 5) return 'card-farm';
      return null;
    }

    render() {
      this.onTabLockChange && this.onTabLockChange();
      if (this.state.completed || this.state.currentStep === 0) {
        this.renderer.hide();
        return;
      }
      const targetKey = this.getTargetKey();
      const target = targetKey ? this.getTarget(targetKey) : null;
      this.renderer.show(target, this.getMessage());
    }
  }

  global.TutorialController = TutorialController;
  if (typeof module !== 'undefined' && module.exports) module.exports = TutorialController;
})(typeof window !== 'undefined' ? window : globalThis);
