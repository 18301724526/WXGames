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

  class TalentPolicyPresenter {
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
      const baseLabel = basePolicy.label || this.t('talent.policy.balanced');
      const labels = {
        agriculture: this.t('talent.tendency.agriculture'),
        knowledge: this.t('talent.tendency.knowledge'),
        industry: this.t('talent.tendency.industry'),
      };
      const join = this.t('talent.name.join');
      const high = Object.entries(labels)
        .filter(([key]) => this.toInteger(tiers[key], 2) === 3)
        .map(([, label]) => label);
      if (high.length) {
        return this.t('talent.name.high', { base: baseLabel, labels: high.slice(0, 2).join(join) });
      }
      const low = Object.entries(labels)
        .filter(([key]) => this.toInteger(tiers[key], 2) === 1)
        .map(([, label]) => label);
      if (low.length) {
        return this.t('talent.name.low', { base: baseLabel, labels: low.slice(0, 2).join(join) });
      }
      return this.t('talent.name.tweak', { base: baseLabel });
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
        || {
          id: 'balanced',
          label: this.t('talent.policy.balanced'),
          description: this.t('talent.policy.balancedDesc'),
        };
      const tendencies = Array.isArray(source.tendencies) ? source.tendencies : [
        { id: 'agriculture', label: this.t('talent.tendency.agriculture'), role: 'farmer', disabled: false },
        { id: 'knowledge', label: this.t('talent.tendency.knowledge'), role: 'scholar', disabled: false },
        {
          id: 'industry',
          label: this.t('talent.tendency.industry'),
          role: 'craftsman',
          disabled: this.toNumber(state.currentEra) < 2,
        },
      ];
      const activePreview = source.preview || {};
      const preview = this.buildTalentPolicyDraftPreview(state, draft, basePolicy, tendencies) || activePreview;
      const allocation = preview.allocation || {};
      const jobLabels = {
        farmer: this.t('home.job.farmer'),
        scholar: this.t('home.job.scholar'),
        craftsman: this.t('home.job.craftsman'),
      };
      const allocationText = ['farmer', 'scholar', 'craftsman']
        .filter((job) => job !== 'craftsman' || this.toNumber(state.currentEra) >= 2 || this.toNumber(allocation[job]) > 0)
        .map((job) => `${jobLabels[job]} ${this.toInteger(allocation[job])}`)
        .join(' / ');
      const tierLabels = {
        1: this.t('talent.tier.low'),
        2: this.t('talent.tier.steady'),
        3: this.t('talent.tier.high'),
      };
      const activePolicyLabel = activeDraftPolicy?.displayName
        || activeCustomPolicy?.displayName
        || activeCustomPolicy?.label
        || activeSystemPolicy?.label
        || source.activePolicyLabel
        || activePreview.policyLabel
        || basePolicy.label;
      const draftPolicyLabel = basePolicy.label || preview.policyLabel || this.t('talent.policy.balanced');
      const isDefaultDraft = ['agriculture', 'knowledge', 'industry']
        .every((key) => this.toInteger(draft.tiers[key], 2) === this.toInteger(source.defaultTiers?.[key], 2));
      const previewPolicyLabel = isDefaultDraft ? draftPolicyLabel : this.makeTalentPolicyName(basePolicy, draft.tiers);
      const hasPendingPreview = previewPolicyLabel !== activePolicyLabel;
      const activeLabel = activePolicyLabel || this.t('talent.policy.balanced');
      const subtitle = hasPendingPreview
        ? this.t('talent.subtitle.withPreview', { active: activeLabel, preview: previewPolicyLabel })
        : this.t('talent.subtitle.activeOnly', { active: activeLabel });

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
          label: policy.displayName || policy.label || this.t('talent.customPolicyName'),
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
          allocationText: allocationText || this.t('talent.allocationEmpty'),
        },
        text: {
          title: this.t('talent.ui.title'),
          subtitle,
          presetTitle: this.t('talent.ui.presetTitle'),
          customTitle: this.t('talent.ui.customTitle'),
          customName: this.makeTalentPolicyName(basePolicy, draft.tiers),
          emptyCustom: this.t('talent.ui.emptyCustom'),
          applyDraft: this.t('talent.ui.applyDraft'),
          saveDraft: this.t('talent.ui.saveDraft'),
        },
      };
    }
  }

  global.TalentPolicyPresenter = TalentPolicyPresenter;
  if (typeof module !== 'undefined' && module.exports) module.exports = TalentPolicyPresenter;
})(typeof window !== 'undefined' ? window : globalThis);
