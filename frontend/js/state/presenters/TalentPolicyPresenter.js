(function (global) {
  class TalentPolicyPresenter {
    static toNumber(value, fallback = 0) {
      const number = Number(value);
      return Number.isFinite(number) ? number : fallback;
    }

    static toInteger(value, fallback = 0) {
      return Math.floor(this.toNumber(value, fallback));
    }

    static getDefaultTalentPolicyDraft(state = {}, uiState = {}) {
      const source = state.talentPolicies || {};
      const systemPolicies = Array.isArray(source.systemPolicies) ? source.systemPolicies : [];
      const customPolicies = Array.isArray(source.customPolicies) ? source.customPolicies : [];
      const activeIsSystem = systemPolicies.some((policy) => policy.id === source.activePolicyId);
      const activeCustom = customPolicies.find((policy) => policy.id === source.activePolicyId) || null;
      const activeDraft = source.activePolicyId === 'draft' && source.activeDraft ? source.activeDraft : null;
      const selected = uiState.selectedBasePolicyId
        || uiState.basePolicyId
        || activeDraft?.basePolicyId
        || activeCustom?.basePolicyId
        || (activeIsSystem ? source.activePolicyId : null)
        || 'balanced';
      const fallbackTiers = source.defaultTiers || { agriculture: 2, knowledge: 2, industry: 2 };
      const activeTiers = activeDraft?.tiers || activeCustom?.tiers || fallbackTiers;
      return {
        basePolicyId: selected,
        tiers: {
          agriculture: this.toInteger(uiState.tiers?.agriculture ?? activeTiers.agriculture, 2),
          knowledge: this.toInteger(uiState.tiers?.knowledge ?? activeTiers.knowledge, 2),
          industry: this.toInteger(uiState.tiers?.industry ?? activeTiers.industry, 2),
        },
      };
    }

    static makeTalentPolicyName(basePolicy = {}, tiers = {}) {
      const baseLabel = basePolicy.label || '均衡发展';
      const labels = {
        agriculture: '农业',
        knowledge: '知识',
        industry: '工业',
      };
      const high = Object.entries(labels)
        .filter(([key]) => this.toInteger(tiers[key], 2) === 3)
        .map(([, label]) => label);
      if (high.length) return `${baseLabel}·偏${high.slice(0, 2).join('与')}`;
      const low = Object.entries(labels)
        .filter(([key]) => this.toInteger(tiers[key], 2) === 1)
        .map(([, label]) => label);
      if (low.length) return `${baseLabel}·轻${low.slice(0, 2).join('与')}`;
      return `${baseLabel}·微调`;
    }

    static getTalentPolicyAvailableRoles(state = {}) {
      const currentEra = this.toNumber(state.currentEra);
      return [
        { id: 'farmer', minEra: 0 },
        { id: 'scholar', minEra: 0 },
        { id: 'craftsman', minEra: 2 },
      ].filter((role) => currentEra >= role.minEra).map((role) => role.id);
    }

    static applyTalentPolicyTierModifiers(weights = {}, tiers = {}, tendencies = [], state = {}) {
      const nextWeights = { ...weights };
      (Array.isArray(tendencies) ? tendencies : []).forEach((tendency) => {
        if (tendency.disabled) return;
        const role = tendency.role || ({ agriculture: 'farmer', knowledge: 'scholar', industry: 'craftsman' }[tendency.id]);
        if (!role || !Object.prototype.hasOwnProperty.call(nextWeights, role)) return;
        const tier = Math.max(1, Math.min(3, this.toInteger(tiers[tendency.id], 2)));
        const modifier = tier === 3 ? 2 : (tier === 1 ? -1 : 0);
        nextWeights[role] = Math.max(1, this.toNumber(nextWeights[role], 1) + modifier);
      });
      return this.getTalentPolicyAvailableRoles(state).reduce((result, roleId) => {
        result[roleId] = Math.max(1, this.toNumber(nextWeights[roleId], 1));
        return result;
      }, {});
    }

    static allocateTalentByWeights(total, weights = {}, priority = []) {
      const amount = Math.max(0, this.toInteger(total));
      const roles = Object.keys(weights);
      const allocation = roles.reduce((result, role) => {
        result[role] = 0;
        return result;
      }, {});
      const weightSum = roles.reduce((sum, role) => sum + Math.max(1, this.toNumber(weights[role], 1)), 0);
      if (amount <= 0 || !roles.length || weightSum <= 0) return allocation;

      const raw = roles.map((role) => {
        const weight = Math.max(1, this.toNumber(weights[role], 1));
        const exact = (amount * weight) / weightSum;
        return {
          role,
          weight,
          floor: Math.floor(exact),
          remainder: exact - Math.floor(exact),
          priority: priority.indexOf(role) >= 0 ? priority.indexOf(role) : priority.length,
        };
      });
      raw.forEach((item) => {
        allocation[item.role] = item.floor;
      });
      let remaining = amount - Object.values(allocation).reduce((sum, value) => sum + value, 0);
      raw
        .sort((a, b) => b.weight - a.weight || b.remainder - a.remainder || a.priority - b.priority || a.role.localeCompare(b.role))
        .forEach((item) => {
          if (remaining <= 0) return;
          allocation[item.role] += 1;
          remaining -= 1;
        });
      return allocation;
    }

    static buildTalentPolicyDraftPreview(state = {}, draft = {}, basePolicy = {}, tendencies = []) {
      const activeCity = (state.cityState?.cities || []).find((city) => city.id === (state.activeCityId || state.cityState?.activeCityId));
      const total = activeCity?.population?.total ?? state.population?.total ?? state.totalPop ?? 0;
      const baseWeights = basePolicy.weights || {};
      if (!Object.keys(baseWeights).length) return null;
      const weights = this.applyTalentPolicyTierModifiers(baseWeights, draft.tiers || {}, tendencies, state);
      const allocation = this.allocateTalentByWeights(total, weights, basePolicy.priority || []);
      const label = this.makeTalentPolicyName(basePolicy, draft.tiers || {});
      return {
        policyId: draft.basePolicyId || basePolicy.id || 'balanced',
        policyLabel: label,
        weights,
        allocation: {
          farmer: allocation.farmer || 0,
          scholar: allocation.scholar || 0,
          craftsman: allocation.craftsman || 0,
        },
      };
    }

    static buildTalentPolicyViewState(state = {}, uiState = {}) {
      const source = state.talentPolicies || {};
      const systemPolicies = Array.isArray(source.systemPolicies) ? source.systemPolicies : [];
      const customPolicies = Array.isArray(source.customPolicies) ? source.customPolicies : [];
      const activePolicyId = source.activePolicyId || 'balanced';
      const draft = this.getDefaultTalentPolicyDraft(state, uiState);
      const activeSystemPolicy = systemPolicies.find((policy) => policy.id === activePolicyId) || null;
      const activeCustomPolicy = customPolicies.find((policy) => policy.id === activePolicyId) || null;
      const activeDraftPolicy = activePolicyId === 'draft' && source.activeDraft ? source.activeDraft : null;
      const basePolicy = systemPolicies.find((policy) => policy.id === draft.basePolicyId)
        || systemPolicies.find((policy) => policy.id === activePolicyId)
        || systemPolicies[0]
        || { id: 'balanced', label: '均衡发展', description: '维持稳定分工' };
      const tendencies = Array.isArray(source.tendencies) ? source.tendencies : [
        { id: 'agriculture', label: '农业', role: 'farmer', disabled: false },
        { id: 'knowledge', label: '知识', role: 'scholar', disabled: false },
        { id: 'industry', label: '工业', role: 'craftsman', disabled: this.toNumber(state.currentEra) < 2 },
      ];
      const activePreview = source.preview || {};
      const preview = this.buildTalentPolicyDraftPreview(state, draft, basePolicy, tendencies) || activePreview;
      const allocation = preview.allocation || {};
      const jobLabels = { farmer: '农民', scholar: '学者', craftsman: '工匠' };
      const allocationText = ['farmer', 'scholar', 'craftsman']
        .filter((job) => job !== 'craftsman' || this.toNumber(state.currentEra) >= 2 || this.toNumber(allocation[job]) > 0)
        .map((job) => `${jobLabels[job]} ${this.toInteger(allocation[job])}`)
        .join(' / ');
      const tierLabels = {
        1: '低',
        2: '稳',
        3: '高',
      };
      const activePolicyLabel = activeDraftPolicy?.displayName
        || activeCustomPolicy?.displayName
        || activeCustomPolicy?.label
        || activeSystemPolicy?.label
        || source.activePolicyLabel
        || activePreview.policyLabel
        || basePolicy.label;
      const draftPolicyLabel = basePolicy.label || preview.policyLabel || '均衡发展';
      const isDefaultDraft = ['agriculture', 'knowledge', 'industry']
        .every((key) => this.toInteger(draft.tiers[key], 2) === this.toInteger(source.defaultTiers?.[key], 2));
      const previewPolicyLabel = isDefaultDraft ? draftPolicyLabel : this.makeTalentPolicyName(basePolicy, draft.tiers);
      const hasPendingPreview = previewPolicyLabel !== activePolicyLabel;
      const subtitle = hasPendingPreview
        ? `当前：${activePolicyLabel || '均衡发展'} / 预览：${previewPolicyLabel}`
        : `当前：${activePolicyLabel || '均衡发展'}`;

      return {
        activePolicyId,
        activePolicyLabel,
        systemPolicies: systemPolicies.map((policy) => ({
          ...policy,
          active: policy.id === activePolicyId,
          selected: policy.id === draft.basePolicyId,
        })),
        customPolicies: customPolicies.map((policy) => ({
          ...policy,
          label: policy.displayName || policy.label || '自定义方针',
          active: policy.id === activePolicyId,
        })),
        tendencies: tendencies.map((tendency) => ({
          ...tendency,
          tier: Math.max(1, Math.min(3, this.toInteger(draft.tiers[tendency.id], 2))),
          tierLabel: tierLabels[Math.max(1, Math.min(3, this.toInteger(draft.tiers[tendency.id], 2)))],
        })),
        draft: {
          ...draft,
          displayName: this.makeTalentPolicyName(basePolicy, draft.tiers),
        },
        preview: {
          ...activePreview,
          ...preview,
          allocationText: allocationText || '暂无人才',
        },
        text: {
          title: '人才方针',
          subtitle,
          presetTitle: '系统方针',
          customTitle: '自定义微调',
          customName: this.makeTalentPolicyName(basePolicy, draft.tiers),
          emptyCustom: '暂无自定义方针',
          applyDraft: '确认方针',
          saveDraft: '保存微调',
        },
      };
    }
  }

  global.TalentPolicyPresenter = TalentPolicyPresenter;
  if (typeof module !== 'undefined' && module.exports) module.exports = TalentPolicyPresenter;
})(typeof window !== 'undefined' ? window : globalThis);
