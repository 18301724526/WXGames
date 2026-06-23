(function (global) {
  const LocaleText = (() => {
    if (global.LocaleText) return global.LocaleText;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../../domain/LocaleText');
      } catch (_error) {
        return null;
      }
    }
    return null;
  })();

  class EventPresenter {
    static t(key, params = {}) {
      return LocaleText ? LocaleText.t(key, params) : key;
    }

    static toNumber(value, fallback = 0) {
      const number = Number(value);
      return Number.isFinite(number) ? number : fallback;
    }

    static toInteger(value, fallback = 0) {
      return Math.floor(this.toNumber(value, fallback));
    }

    static trimDecimal(value) {
      return String(value).replace(/\.0$/, '');
    }

    static formatCompactNumber(value, options = {}) {
      const number = this.toNumber(value);
      const floorSmall = options.floorSmall !== false;
      const sign = number < 0 ? '-' : '';
      const abs = Math.abs(number);
      if (abs < 1000) {
        return floorSmall ? Math.floor(number) : this.trimDecimal(Math.round(number * 100) / 100);
      }
      const units = [
        { value: 1_000_000_000_000, suffix: 'T' },
        { value: 1_000_000_000, suffix: 'G' },
        { value: 1_000_000, suffix: 'M' },
        { value: 1_000, suffix: 'k' },
      ];
      const unit = units.find((item) => abs >= item.value) || units[units.length - 1];
      const scaled = Math.floor((abs / unit.value) * 10) / 10;
      return `${sign}${this.trimDecimal(scaled.toFixed(1))}${unit.suffix}`;
    }

    static formatResourceAmount(value) {
      return this.formatCompactNumber(value, { floorSmall: true });
    }

    static getEventResourceLabel(resource) {
      return {
        food: this.t('event.resource.food', {}, '食物'),
        knowledge: this.t('event.resource.knowledge', {}, '知识'),
        wood: this.t('event.resource.wood', {}, '木材'),
        iron: this.t('event.resource.iron', {}, '铁矿'),
        stone: this.t('event.resource.stone', {}, '石料'),
        metal: this.t('event.resource.iron', {}, '铁矿'),
      }[resource] || resource;
    }

    static formatEventResourcePart(resource, value) {
      const amount = this.toNumber(value);
      if (!amount) return '';
      const sign = amount > 0 ? '+' : '-';
      return `${this.getEventResourceLabel(resource)} ${sign}${this.formatResourceAmount(Math.abs(amount))}`;
    }

    static buildEventResourcePart(resource, value) {
      const amount = this.toNumber(value);
      if (!amount) return null;
      const sign = amount > 0 ? '+' : '-';
      return {
        type: 'resource',
        resource: resource === 'metal' ? 'iron' : resource,
        text: `${sign}${this.formatResourceAmount(Math.abs(amount))}`,
      };
    }

    static formatEventDuration(seconds) {
      const total = this.toInteger(seconds);
      if (total <= 0) return '';
      if (total < 60) return this.t('event.duration.seconds', { seconds: total }, `${total}秒`);
      const minutes = Math.floor(total / 60);
      const rest = total % 60;
      return rest
        ? this.t('event.duration.minutesSeconds', { minutes, seconds: rest }, `${minutes}分${rest}秒`)
        : this.t('event.duration.minutes', { minutes }, `${minutes}分钟`);
    }

    static formatEventBuffEffect(effect = {}) {
      const value = this.toNumber(effect.value);
      const duration = this.formatEventDuration(effect.durationSeconds);
      const prefix = duration ? `${duration} ` : '';
      const durationParam = duration ? `${duration} ` : '';
      const sign = value >= 0 ? '+' : '';
      if (effect.buffType === 'resourceMultiplier') {
        return this.t(
          'event.buff.resourceMultiplier',
          { duration: durationParam, resource: this.getEventResourceLabel(effect.target), sign, percent: Math.round(value * 100) },
          `${prefix}${this.getEventResourceLabel(effect.target)}产出 ${value >= 0 ? '+' : ''}${Math.round(value * 100)}%`,
        );
      }
      if (effect.buffType === 'offlineEfficiencyBonus') {
        return this.t(
          'event.buff.offlineEfficiency',
          { duration: durationParam, sign, percent: Math.round(value * 100) },
          `${prefix}离线收益效率 ${value >= 0 ? '+' : ''}${Math.round(value * 100)}%`,
        );
      }
      if (effect.buffType === 'happinessFlat') {
        return this.t(
          'event.buff.happiness',
          { duration: durationParam, sign, value: this.formatCompactNumber(value, { floorSmall: false }) },
          `${prefix}幸福度 ${value >= 0 ? '+' : ''}${this.formatCompactNumber(value, { floorSmall: false })}`,
        );
      }
      return effect.label ? `${prefix}${effect.label}` : this.t('event.buff.temporary', { duration: durationParam }, `${prefix}临时加成`);
    }

    static formatEventEffect(effect = {}) {
      const value = this.toNumber(effect.value);
      if (effect.type === 'resource') return this.formatEventResourcePart(effect.key, value);
      if (effect.type === 'soldiers') {
        if (!value) return '';
        const sign = value > 0 ? '+' : '-';
        const amount = this.formatResourceAmount(Math.abs(value));
        return this.t('event.effect.soldiers', { sign, amount }, `士兵 ${sign}${amount}`);
      }
      if (effect.type === 'buff') return this.formatEventBuffEffect(effect);
      return '';
    }

    static buildEventEffectPart(effect = {}) {
      const value = this.toNumber(effect.value);
      if (!value) return null;
      if (effect.type === 'resource') return this.buildEventResourcePart(effect.key, value);
      if (effect.type === 'soldiers') {
        const sign = value > 0 ? '+' : '-';
        return { type: 'resource', resource: 'soldier', text: `${sign}${this.formatResourceAmount(Math.abs(value))}` };
      }
      if (effect.type === 'buff') return { type: 'text', text: this.formatEventBuffEffect(effect) };
      return null;
    }

    static formatEventEffects(effects = [], filter = 'all') {
      return (effects || [])
        .map((effect) => {
          const value = this.toNumber(effect?.value);
          const isBuff = effect?.type === 'buff';
          const isPositive = isBuff ? value >= 0 : value > 0;
          const isNegative = value < 0;
          if (filter === 'positive' && !isPositive) return '';
          if (filter === 'negative' && !isNegative) return '';
          return this.formatEventEffect(effect);
        })
        .filter(Boolean)
        .join(' ');
    }

    static buildEventEffectParts(effects = [], filter = 'all') {
      return (effects || [])
        .map((effect) => {
          const value = this.toNumber(effect?.value);
          const isBuff = effect?.type === 'buff';
          const isPositive = isBuff ? value >= 0 : value > 0;
          const isNegative = value < 0;
          if (filter === 'positive' && !isPositive) return null;
          if (filter === 'negative' && !isNegative) return null;
          return this.buildEventEffectPart(effect);
        })
        .filter(Boolean);
    }

    static formatEventRequirements(requirements = {}) {
      if (!requirements || typeof requirements !== 'object') return '';
      const parts = [];
      const defense = Number(requirements.defense);
      const soldiers = Number(requirements.soldiers);
      if (Number.isFinite(defense)) parts.push(this.t('event.requirement.defense', { value: this.formatResourceAmount(defense) }, `防御 ${this.formatResourceAmount(defense)}`));
      if (Number.isFinite(soldiers)) parts.push(this.t('event.requirement.soldiers', { value: this.formatResourceAmount(soldiers) }, `士兵 ${this.formatResourceAmount(soldiers)}`));
      return parts.join('，');
    }

    static buildEventRequirementParts(requirements = {}) {
      if (!requirements || typeof requirements !== 'object') return [];
      const parts = [];
      const defense = Number(requirements.defense);
      const soldiers = Number(requirements.soldiers);
      if (Number.isFinite(defense)) parts.push({ type: 'text', text: this.t('event.requirement.defense', { value: this.formatResourceAmount(defense) }, `防御 ${this.formatResourceAmount(defense)}`) });
      if (Number.isFinite(soldiers)) parts.push({ type: 'resource', resource: 'soldier', text: String(this.formatResourceAmount(soldiers)) });
      return parts;
    }

    static formatEventReward(reward) {
      if (!reward) return this.t('event.completed', {}, '事件已完成');
      const parts = [];
      if (reward.food) parts.push(this.formatEventResourcePart('food', reward.food));
      if (reward.knowledge) parts.push(this.formatEventResourcePart('knowledge', reward.knowledge));
      if (reward.wood) parts.push(this.formatEventResourcePart('wood', reward.wood));
      if (reward.iron || reward.metal) parts.push(this.formatEventResourcePart('iron', reward.iron || reward.metal));
      if (reward.stone) parts.push(this.formatEventResourcePart('stone', reward.stone));
      return parts.join(' ') || this.t('event.completed', {}, '事件已完成');
    }

    static buildEventRewardParts(reward = {}) {
      if (!reward || typeof reward !== 'object') return [];
      return ['food', 'wood', 'iron', 'stone', 'knowledge']
        .map((resource) => this.buildEventResourcePart(resource, reward[resource] ?? (resource === 'iron' ? reward.metal : undefined)))
        .filter(Boolean);
    }

    static getEventOptionRewardText(option = {}) {
      const successEffects = Array.isArray(option.successEffects) ? option.successEffects : [];
      const directEffects = Array.isArray(option.effects) ? option.effects : [];
      const effectReward = this.formatEventEffects(option.requirements ? successEffects : directEffects, 'positive');
      const explicitReward = option.reward ? this.formatEventReward(option.reward) : '';
      return effectReward || explicitReward;
    }

    static getEventOptionRewardParts(option = {}) {
      const successEffects = Array.isArray(option.successEffects) ? option.successEffects : [];
      const directEffects = Array.isArray(option.effects) ? option.effects : [];
      const effectParts = this.buildEventEffectParts(option.requirements ? successEffects : directEffects, 'positive');
      const explicitParts = option.reward ? this.buildEventRewardParts(option.reward) : [];
      return effectParts.length ? effectParts : explicitParts;
    }

    static getEventOptionCostText(option = {}) {
      const successEffects = Array.isArray(option.successEffects) ? option.successEffects : [];
      const directEffects = Array.isArray(option.effects) ? option.effects : [];
      return this.formatEventEffects(option.requirements ? successEffects : directEffects, 'negative');
    }

    static getEventOptionCostParts(option = {}) {
      const successEffects = Array.isArray(option.successEffects) ? option.successEffects : [];
      const directEffects = Array.isArray(option.effects) ? option.effects : [];
      return this.buildEventEffectParts(option.requirements ? successEffects : directEffects, 'negative');
    }

    static getEventOptionPenaltyText(option = {}) {
      const failureEffects = Array.isArray(option.failureEffects) ? option.failureEffects : [];
      const timeoutEffects = Array.isArray(option.timeoutEffects) ? option.timeoutEffects : [];
      return this.formatEventEffects(failureEffects.length ? failureEffects : timeoutEffects, 'negative');
    }

    static getEventOptionPenaltyParts(option = {}) {
      const failureEffects = Array.isArray(option.failureEffects) ? option.failureEffects : [];
      const timeoutEffects = Array.isArray(option.timeoutEffects) ? option.timeoutEffects : [];
      return this.buildEventEffectParts(failureEffects.length ? failureEffects : timeoutEffects, 'negative');
    }

    static buildEventOptionRows(option = {}) {
      const requirementText = this.formatEventRequirements(option.requirements);
      const rewardText = this.getEventOptionRewardText(option);
      const costText = this.getEventOptionCostText(option);
      const penaltyText = this.getEventOptionPenaltyText(option);
      return [
        { label: this.t('event.row.requirement', {}, '需求'), text: requirementText || this.t('common.none', {}, '无'), tone: 'requirement', parts: this.buildEventRequirementParts(option.requirements), empty: !requirementText },
        { label: this.t('event.row.reward', {}, '奖励'), text: rewardText || this.t('common.none', {}, '无'), tone: 'reward', parts: this.getEventOptionRewardParts(option), empty: !rewardText },
        { label: this.t('event.row.cost', {}, '消耗'), text: costText || this.t('common.none', {}, '无'), tone: 'cost', parts: this.getEventOptionCostParts(option), empty: !costText },
        { label: this.t('event.row.penalty', {}, '惩罚'), text: penaltyText || this.t('common.none', {}, '无'), tone: 'penalty', parts: this.getEventOptionPenaltyParts(option), empty: !penaltyText },
      ];
    }

    static getEventOptionPreview(option) {
      if (option?.preview) return option.preview;
      if (option?.reward) return this.formatEventReward(option.reward);
      const rows = this.buildEventOptionRows(option);
      const visibleRows = rows.filter((row) => !row.empty);
      if (visibleRows.length) return visibleRows.map((row) => `${row.label} ${row.text}`).join('；');
      return this.formatEventReward(option?.reward);
    }

    static getRemainingSeconds(expiresAt, nowMs = Date.now()) {
      const expiresAtMs = new Date(expiresAt).getTime();
      if (!Number.isFinite(expiresAtMs)) return null;
      return Math.max(0, Math.ceil((expiresAtMs - nowMs) / 1000));
    }

    static formatRemainingTime(expiresAt, nowMs = Date.now()) {
      const seconds = this.getRemainingSeconds(expiresAt, nowMs);
      if (seconds === null) return '';
      const minutes = Math.floor(seconds / 60);
      const rest = seconds % 60;
      return `${minutes}:${String(rest).padStart(2, '0')}`;
    }

    static getEventHint(event, nowMs = Date.now()) {
      const remaining = this.formatRemainingTime(event?.expiresAt, nowMs);
      if (event?.type === 'threat') {
        if (!remaining) return this.t('event.hint.threatNoTime', {}, '超时将按失败处理');
        return this.t('event.hint.threatTimed', { remaining }, `剩余 ${remaining}，超时将按失败处理`);
      }
      if (event?.type === 'regular') {
        if (!remaining) return this.t('event.hint.regularNoTime', {}, '超时将自动失效');
        return this.t('event.hint.regularTimed', { remaining }, `剩余 ${remaining}，超时将自动失效`);
      }
      return this.t('event.hint.details', {}, '点击查看详情');
    }

    static buildEventCardViewState(event = {}, nowMs = Date.now()) {
      return {
        id: event.id || '',
        icon: event.icon || '📜',
        iconAsset: 'assets/art/icon-event-cutout.webp',
        title: event.title || '',
        description: event.description || '',
        hint: this.getEventHint(event, nowMs),
        classState: {
          'is-special': event.type === 'special',
          'is-threat': event.type === 'threat',
        },
      };
    }

    static buildEventHistoryItemViewState(event = {}) {
      const selectedOption = event.selectedOptionId
        ? event.options?.find((item) => item.id === event.selectedOptionId)
        : null;
      return {
        icon: event.icon || '📜',
        iconAsset: 'assets/art/icon-event-cutout.webp',
        title: event.title || '',
        result: event.resultSummary || this.formatEventReward(selectedOption?.reward),
        className: event.type === 'threat' ? 'threat' : 'positive',
      };
    }

    static buildEventViewState(state = {}, options = {}) {
      const nowMs = options.nowMs ?? Date.now();
      const eventQueue = Array.isArray(state.eventQueue) ? state.eventQueue : [];
      const eventHistory = Array.isArray(state.eventHistory) ? state.eventHistory : [];
      const pendingCards = eventQueue.map((event) => this.buildEventCardViewState(event, nowMs));
      const historyItems = eventHistory.map((event) => this.buildEventHistoryItemViewState(event));
      return {
        badge: {
          hidden: !eventQueue.length,
          text: eventQueue.length > 9 ? '9+' : String(eventQueue.length),
        },
        pending: {
          isEmpty: !pendingCards.length,
          emptyText: this.t('event.empty.pending', {}, '暂无待处理事件'),
          cards: pendingCards,
        },
        history: {
          isEmpty: !historyItems.length,
          emptyText: this.t('event.empty.history', {}, '暂无事件记录'),
          items: historyItems,
        },
      };
    }

    static buildEventModalViewState(eventData = {}, options = {}) {
      const nowMs = options.nowMs ?? Date.now();
      const eventOptions = Array.isArray(eventData.options) ? eventData.options : [];
      const optionViews = eventOptions.map((option) => {
        const rows = this.buildEventOptionRows(option);
        return {
          id: option.id || '',
          label: option.label || this.t('event.action.handle', {}, '处理事件'),
          preview: this.getEventOptionPreview(option),
          rows,
        };
      });
      const firstOption = optionViews[0];
      const singleOptionPreview = optionViews.length === 1
        ? optionViews[0].preview
        : this.t('event.option.choose', {}, '选择一种处理方式');
      const expiryHint = ['threat', 'regular'].includes(eventData?.type)
        ? this.getEventHint(eventData, nowMs)
        : '';

      const metaRows = [];
      if (expiryHint) {
        metaRows.push({
          label: this.t('event.row.deadline', {}, '时限'),
          text: expiryHint,
          tone: eventData?.type === 'threat' ? 'penalty' : 'time',
        });
      }
      if (optionViews.length > 1) {
        metaRows.push({
          label: this.t('event.row.option', {}, '选项'),
          text: this.t('event.option.choose', {}, '选择一种处理方式'),
          tone: 'neutral',
        });
      }

      return {
        iconAsset: 'assets/art/icon-event-cutout.webp',
        text: {
          title: eventData.title || '',
          description: eventData.description || '',
          reward: expiryHint ? `${singleOptionPreview} | ${expiryHint}` : singleOptionPreview,
        },
        metaRows,
        options: optionViews,
        claimButton: {
          optionId: firstOption?.id || '',
          label: firstOption?.label || this.t('event.action.handle', {}, '处理事件'),
          hidden: optionViews.length !== 1,
        },
        showModal: true,
      };
    }
  }

  global.EventPresenter = EventPresenter;
  if (typeof module !== 'undefined' && module.exports) module.exports = EventPresenter;
})(typeof window !== 'undefined' ? window : globalThis);
