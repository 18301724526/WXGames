(function (global) {
  const PHASE_COMPLETE_STEP = 8;
  const FINAL_STEP = 15;

  function createFallbackState(step = 0) {
    return {
      completed: step >= FINAL_STEP,
      currentStep: step,
      phaseCompleted: {
        newbie: step >= PHASE_COMPLETE_STEP,
        era2: step >= FINAL_STEP,
      },
    };
  }

  class TutorialController {
    constructor(options) {
      this.api = options.api;
      this.renderer = options.renderer;
      this.getTarget = options.getTarget;
      this.getCurrentTab = options.getCurrentTab || (() => 'resources');
      this.isEventModalOpen = options.isEventModalOpen || (() => false);
      this.getState = options.getState || (() => ({}));
      this.onTabLockChange = options.onTabLockChange;
      this.storage = options.storage || {
        isAutoStarted: () => false,
        setAutoStarted: () => {},
        setProgress: () => {},
      };
      this.startDelayMs = Number(options.startDelayMs) || 0;
      this.scheduler = {
        setTimeout: (callback) => {
          callback();
          return null;
        },
        ...(options.scheduler || {}),
      };
      this.state = createFallbackState(0);
      this.autoStarted = this.storage.isAutoStarted();
    }

    canAffordLumbermill() {
      const state = this.getState() || {};
      const resources = state.resources || {};
      const cost = state.buildingCosts?.lumbermill || { food: 50, wood: 15 };
      return Object.entries(cost).every(([key, value]) => (resources[key] || 0) >= value);
    }

    isSoftGuideStep() {
      return this.state.currentStep === 8 || (this.state.currentStep === 13 && !this.canAffordLumbermill());
    }

    syncLocalProgress() {
      this.storage.setProgress(this.state);
    }

    syncAutoStartedFlag() {
      if (this.state.completed || this.state.currentStep > 0) {
        this.autoStarted = true;
        this.storage.setAutoStarted(true);
        return;
      }
      // 服务端返回 step 0 时，以服务端为准重新允许自动启动。
      this.autoStarted = false;
      this.storage.setAutoStarted(false);
    }

    setState(tutorial) {
      this.state = tutorial || createFallbackState(0);
      this.syncLocalProgress();
      this.syncAutoStartedFlag();
      this.render();
      if (!this.state.completed && this.state.currentStep === 0 && !this.autoStarted) {
        this.autoStarted = true;
        this.storage.setAutoStarted(true);
        this.scheduler.setTimeout(() => this.advanceTo(1).catch((error) => {
          console.warn('[tutorial] auto start failed:', error);
          this.autoStarted = false;
          this.storage.setAutoStarted(false);
        }), this.startDelayMs);
      }
    }

    async advanceTo(step) {
      if (this.state.completed || step <= this.state.currentStep) return;
      const data = await this.api.advanceTutorial(step);
      this.state = data.tutorial || createFallbackState(step);
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
      } else if (this.state.currentStep === 9 && tabId === 'civilization') {
        this.render();
      } else if (this.state.currentStep === 10 && tabId === 'events') {
        await this.advanceTo(11);
      } else if (this.state.currentStep === 12 && tabId === 'buildings') {
        await this.advanceTo(13);
      }
      return true;
    }

    notifyEraAdvanced(remoteTutorial) {
      this.state = remoteTutorial || createFallbackState(4);
      this.render();
    }

    notifyFarmBuilt(remoteTutorial) {
      this.state = remoteTutorial || createFallbackState(7);
      this.syncLocalProgress();
      this.syncAutoStartedFlag();
      this.render();
    }

    notifyHouseBuilt(remoteTutorial) {
      this.state = remoteTutorial || createFallbackState(8);
      this.syncLocalProgress();
      this.syncAutoStartedFlag();
      this.render();
    }

    notifySpecialEventClaimed(remoteTutorial) {
      this.state = remoteTutorial || createFallbackState(12);
      this.syncLocalProgress();
      this.render();
    }

    notifyLumbermillBuilt(remoteTutorial) {
      this.state = remoteTutorial || createFallbackState(14);
      this.syncLocalProgress();
      this.render();
    }

    notifyCraftsmanAssigned(remoteTutorial) {
      this.state = remoteTutorial || createFallbackState(15);
      this.syncLocalProgress();
      this.syncAutoStartedFlag();
      this.render();
    }

    canOpenTab(tabId) {
      if (this.state.completed) return true;
      if (this.isSoftGuideStep()) return true;
      const step = this.state.currentStep;
      if (step <= 1) return ['resources', 'civilization'].includes(tabId);
      if (step <= 3) return tabId === 'civilization';
      if (step === 4) return ['civilization', 'buildings'].includes(tabId);
      if (step <= 7) return tabId === 'buildings';
      if (step === 8) return true;
      if (step === 9) return tabId === 'civilization';
      if (step === 10) return ['civilization', 'events'].includes(tabId);
      if (step === 11) return tabId === 'events';
      if (step === 12) return ['events', 'buildings'].includes(tabId);
      if (step === 13) return ['buildings', 'resources'].includes(tabId);
      if (step === 14) return ['buildings', 'resources'].includes(tabId);
      return true;
    }

    getMessage() {
      const step = this.state.currentStep;
      const currentTab = this.getCurrentTab();
      if (step === 1) return '点击这里，查看文明进展';
      if (step === 2) return '食物足够了！进阶到农耕时代';
      if (step === 4) return '新时代解锁了建筑！';
      if (step === 5) return '建造第一座农田';
      if (step === 7) return '人口在增长，先建造民居为新居民腾出空间';
      if (step === 8) return currentTab === 'resources'
        ? '民居已建好，继续积累进阶所需食物和知识'
        : '民居已建好，可以继续积累进阶所需资源';
      if (step === 9) return currentTab === 'civilization'
        ? '条件已满足，点击进阶进入聚落时代'
        : '资源已满足，先打开文明页面查看时代进阶';
      if (step === 10) return '森林里似乎有什么发现...';
      if (step === 11) return this.isEventModalOpen()
        ? '选择处理方式领取木材奖励'
        : '打开森林低语，领取你的第一批木材';
      if (step === 12) return '用新发现的木材建造伐木场';
      if (step === 13) {
        if (!this.canAffordLumbermill()) {
          return currentTab === 'resources'
            ? '食物还不够，先积累到 50 食物再建造伐木场'
            : '建造伐木场还缺食物，先回资源页面积累';
        }
        return currentTab === 'buildings'
          ? '伐木场产出木材，先把它建起来'
          : '资源已满足，回到建筑页面建造伐木场';
      }
      if (step === 14) return currentTab === 'resources'
        ? '分配 1 名工匠去伐木场工作'
        : '伐木场建好了，回到资源页面分配工匠';
      if (step === 15) return '聚落时代开启！继续建设吧';
      return '';
    }

    getTargetKey() {
      const step = this.state.currentStep;
      const currentTab = this.getCurrentTab();
      if (step === 1) return 'tab-civilization';
      if (step === 2) return 'btn-advance-era';
      if (step === 4) return 'tab-buildings';
      if (step === 5) return currentTab === 'buildings' ? 'card-farm' : 'tab-buildings';
      if (step === 7) return currentTab === 'buildings' ? 'card-house' : 'tab-buildings';
      if (step === 8) return 'tab-resources';
      if (step === 9) return currentTab === 'civilization' ? 'btn-advance-era' : 'tab-civilization';
      if (step === 10) return 'tab-events';
      if (step === 11) return 'tab-events';
      if (step === 12) return 'tab-buildings';
      if (step === 13) {
        if (!this.canAffordLumbermill()) return 'tab-resources';
        return currentTab === 'buildings' ? 'card-lumbermill' : 'tab-buildings';
      }
      if (step === 14) return 'tab-resources';
      return null;
    }

    render() {
      this.onTabLockChange && this.onTabLockChange();
      if (this.state.completed || this.state.currentStep === 0) {
        this.renderer.hide();
        return;
      }
      if (this.isSoftGuideStep()) {
        if (typeof this.renderer.showSoft === 'function') this.renderer.showSoft(this.getMessage());
        else this.renderer.hide && this.renderer.hide();
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
