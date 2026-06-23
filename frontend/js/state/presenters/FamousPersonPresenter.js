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

  class FamousPersonPresenter {
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

    static formatFamousPersonSource(source = {}) {
      return source.label || {
        seek: this.t('famous.source.seek', {}),
        event: this.t('famous.source.event', {}),
        postWar: this.t('famous.source.postWar', {}),
      }[source.type] || this.t('famous.source.unknown', {});
    }

    static getFamousPersonEffectLabels() {
      const keys = [
        'directDamage', 'secondHit', 'firstStrike', 'lifesteal', 'combo', 'counter',
        'shield', 'armorBreak', 'burn', 'poison', 'morale', 'heal', 'ambush',
        'attributeBonus', 'resourceOutputPct', 'allBasicOutputPct', 'constructionSpeedPct',
        'constructionCostPct', 'knowledgeOutputPct', 'populationCapPct', 'happinessFlat',
        'trainingSpeedPct', 'eventRewardPct', 'eventRiskReductionPct', 'settlementPacifyPct',
        'famousRetentionPct', 'diplomacyBonusPct', 'scoutReportBonusPct', 'cityStabilityPct',
      ];
      return Object.fromEntries(keys.map((key) => [key, this.t(`famous.effectLabel.${key}`)]));
    }

    static getFamousPersonAttributeLabel(key = '') {
      return {
        command: this.t('famous.attribute.command', {}),
        force: this.t('famous.attribute.force', {}),
        intelligence: this.t('famous.attribute.intelligence', {}),
        strategy: this.t('famous.attribute.intelligence', {}),
        politics: this.t('famous.attribute.politics', {}),
        charisma: this.t('famous.attribute.charisma', {}),
        speed: this.t('famous.attribute.speed', {}),
      }[key] || key || this.t('famous.attribute.title', {});
    }

    static formatFamousPersonPercent(value, fallback = 0) {
      const numeric = Number.isFinite(Number(value)) ? Number(value) : fallback;
      return `${Math.round(numeric * 100)}%`;
    }

    static formatFamousPersonSkillKind(skill = {}) {
      if (skill.slot === 'activeSkill' || skill.kind === 'active') return this.t('famous.skillKind.active');
      if (skill.slot === 'passiveTrait') return this.t('famous.skillKind.passiveTrait');
      if (skill.slot === 'civilPrimary') return this.t('famous.skillKind.civilPrimary');
      if (skill.slot === 'civilSecondary') return this.t('famous.skillKind.civilSecondary');
      if (skill.slot === 'scoutTrait') return this.t('famous.skillKind.scoutTrait');
      if (skill.kind === 'civil') return this.t('famous.skillKind.civil');
      if (skill.kind === 'passive') return this.t('famous.skillKind.passive');
      return this.t('famous.skill.generic');
    }

    static formatFamousPersonCastCondition(condition = {}) {
      const percent = Math.round(Number(condition.value ?? condition.pct ?? 0) * 100);
      const status = condition.status || this.t('famous.castCondition.anyStatus');
      const labels = {
        cooldownReady: '',
        targetAlive: '',
        firstOwnAction: this.t('famous.castCondition.firstOwnAction'),
        selfSoldierBelowPct: this.t('famous.castCondition.selfSoldierBelowPct', { percent }),
        selfSoldierAbovePct: this.t('famous.castCondition.selfSoldierAbovePct', { percent }),
        targetSoldierBelowPct: this.t('famous.castCondition.targetSoldierBelowPct', { percent }),
        targetHasStatus: this.t('famous.castCondition.targetHasStatus', { status }),
        selfHasStatus: this.t('famous.castCondition.selfHasStatus', { status }),
      };
      return Object.prototype.hasOwnProperty.call(labels, condition.type) ? labels[condition.type] : '';
    }

    static formatFamousPersonCooldownText(cooldown, skill = {}) {
      if (cooldown === null || skill.kind !== 'active') return '';
      if (cooldown <= 0) return this.t('famous.cooldown.none');
      return this.t('famous.cooldown.turns', { cooldown });
    }

    static formatFamousPersonCastRate(skill = {}) {
      if (skill.kind !== 'active') return '';
      const raw = skill.castRate ?? skill.triggerRate ?? skill.probability ?? skill.chance ?? skill.rate;
      const numeric = Number(raw);
      if (!Number.isFinite(numeric)) return this.t('famous.castRate', { rate: 100 });
      const normalized = numeric > 1 ? numeric / 100 : numeric;
      return this.t('famous.castRate', { rate: Math.max(0, Math.min(100, Math.round(normalized * 100))) });
    }

    static formatFamousPersonEffectSentence(effect = {}, skill = {}) {
      const key = effect?.key || '';
      const pct = () => this.formatFamousPersonPercent(effect.value);
      if (key === 'directDamage') {
        const damageType = this.t(
          skill.damageType === 'strategy' ? 'famous.damageType.strategy' : 'famous.damageType.physical',
        );
        return this.t('famous.effectDesc.directDamage', { damageType });
      }
      if (key === 'secondHit') return this.t('famous.effectDesc.secondHit');
      if (key === 'firstStrike') return this.t('famous.effectDesc.firstStrike');
      if (key === 'lifesteal') return this.t('famous.effectDesc.lifesteal');
      if (key === 'heal') return this.t('famous.effectDesc.heal');
      if (key === 'shield') return this.t('famous.effectDesc.shield');
      if (key === 'armorBreak') return this.t('famous.effectDesc.armorBreak');
      if (key === 'burn') return this.t('famous.effectDesc.burn');
      if (key === 'poison') return this.t('famous.effectDesc.poison');
      if (key === 'attributeBonus') {
        const attribute = this.getFamousPersonAttributeLabel(effect.attribute || effect.keyAttribute);
        const value = Math.round(Number(effect.value) || 0);
        const descKey =
          skill.kind === 'passive' || skill.slot === 'passiveTrait'
            ? 'famous.effectDesc.attributeBonusPassive'
            : 'famous.effectDesc.attributeBonusActive';
        return this.t(descKey, { attribute, value });
      }
      if (key === 'resourceOutputPct') {
        const resource = this.t(effect.resource === 'food' ? 'famous.word.food' : 'famous.word.resource');
        return this.t('famous.effectDesc.resourceOutputPct', { resource, pct: pct() });
      }
      if (key === 'allBasicOutputPct') return this.t('famous.effectDesc.allBasicOutputPct', { pct: pct() });
      if (key === 'constructionSpeedPct') return this.t('famous.effectDesc.constructionSpeedPct', { pct: pct() });
      if (key === 'constructionCostPct') return this.t('famous.effectDesc.constructionCostPct', { pct: pct() });
      if (key === 'knowledgeOutputPct') return this.t('famous.effectDesc.knowledgeOutputPct', { pct: pct() });
      if (key === 'populationCapPct') return this.t('famous.effectDesc.populationCapPct', { pct: pct() });
      if (key === 'happinessFlat') {
        return this.t('famous.effectDesc.happinessFlat', { value: Math.round(Number(effect.value) || 0) });
      }
      if (key === 'trainingSpeedPct') return this.t('famous.effectDesc.trainingSpeedPct', { pct: pct() });
      if (key === 'eventRewardPct') return this.t('famous.effectDesc.eventRewardPct', { pct: pct() });
      if (key === 'eventRiskReductionPct') return this.t('famous.effectDesc.eventRiskReductionPct', { pct: pct() });
      if (key === 'settlementPacifyPct') return this.t('famous.effectDesc.settlementPacifyPct', { pct: pct() });
      if (key === 'famousRetentionPct') return this.t('famous.effectDesc.famousRetentionPct', { pct: pct() });
      if (key === 'diplomacyBonusPct') return this.t('famous.effectDesc.diplomacyBonusPct', { pct: pct() });
      if (key === 'scoutReportBonusPct') return this.t('famous.effectDesc.scoutReportBonusPct', { pct: pct() });
      if (key === 'cityStabilityPct') return this.t('famous.effectDesc.cityStabilityPct', { pct: pct() });
      return '';
    }

    static buildFamousPersonSkillDescription(skill = {}) {
      const effects = Array.isArray(skill.effects) ? skill.effects : [];
      if (!effects.length) return this.t('famous.skill.noEffectDetail');
      const hasDirectDamage = effects.some((effect) => effect?.key === 'directDamage');
      const hasLifesteal = effects.some((effect) => effect?.key === 'lifesteal');
      if (hasDirectDamage && hasLifesteal) {
        const damageType = this.t(
          skill.damageType === 'strategy' ? 'famous.damageType.strategy' : 'famous.damageType.physical',
        );
        return this.t('famous.effectDesc.directDamageLifesteal', { damageType });
      }
      return effects
        .map((effect) => this.formatFamousPersonEffectSentence(effect, skill))
        .filter(Boolean)
        .join('');
    }

    static sanitizeFamousPersonSkillDescription(skill = {}) {
      const text = String(skill.description || '').trim();
      if (!text) return '';
      if (/自身行动|冷却\s*\d*\s*次|冷却就绪|目标存活|直接伤害|属性修正|二段伤害|吸血|当前阶段|当前仅展示|后续接入|实际收益|实际侦查|再次释放|等自己出手|再出手|才能再放|再放前/.test(text)) return '';
      return text;
    }

    static formatFamousPersonSkillDetail(skill = {}) {
      const effectLabels = this.getFamousPersonEffectLabels();
      const effects = Array.isArray(skill.effects)
        ? skill.effects.map((effect) => effectLabels[effect.key] || effect.key).filter(Boolean)
        : [];
      const conditions = Array.isArray(skill.castConditions)
        ? skill.castConditions.map((condition) => this.formatFamousPersonCastCondition(condition)).filter(Boolean)
        : [];
      const cooldown = Number.isFinite(Number(skill.cooldown)) ? Math.max(0, Math.floor(Number(skill.cooldown))) : null;
      const kindText = this.formatFamousPersonSkillKind(skill);
      const effectText = effects.length ? effects.join(' / ') : this.t('famous.skill.noEffect');
      const cooldownText = this.formatFamousPersonCooldownText(cooldown, skill);
      const castRateText = this.formatFamousPersonCastRate(skill);
      const triggerText = skill.trigger === 'preBattle'
        ? this.t('famous.trigger.preBattle')
        : (skill.trigger === 'passiveStored' ? this.t('famous.trigger.passiveStored') : conditions.join(' · '));
      const statusText = skill.implementationStatus === 'storedOnly' ? this.t('famous.status.storedOnly') : '';
      const meta = [cooldownText, castRateText, triggerText, statusText].filter(Boolean).join(' · ');
      const description = this.sanitizeFamousPersonSkillDescription(skill) || this.buildFamousPersonSkillDescription(skill);
      return {
        id: skill.id || skill.name || '',
        name: skill.name || this.t('famous.skill.generic'),
        kindText,
        effectText,
        meta,
        description,
        summary: `${skill.name || this.t('famous.skill.generic')} · ${description}`,
      };
    }

    static formatFamousPersonSkill(skill = {}) {
      return this.formatFamousPersonSkillDetail(skill).summary;
    }

    static getFamousPersonAbilities(person = {}) {
      const abilities = Array.isArray(person.abilityKit?.abilities) ? person.abilityKit.abilities : [];
      if (abilities.length) return abilities;
      return Array.isArray(person.skills) ? person.skills : [];
    }

    static getFamousPersonQualityInfo(quality = '') {
      const key = String(quality || 'common').trim() || 'common';
      const map = {
        legendary: { key: 'legendary', label: this.t('famous.quality.legendary', {}), rank: 4, frame: 'gold' },
        great: { key: 'great', label: this.t('famous.quality.great', {}), rank: 3, frame: 'purple' },
        good: { key: 'good', label: this.t('famous.quality.good', {}), rank: 2, frame: 'blue' },
        common: { key: 'common', label: this.t('famous.quality.common', {}), rank: 1, frame: 'white' },
      };
      return map[key] || map.common;
    }

    static getNextFamousAttributePointLevel(level = 1) {
      const current = Math.max(1, this.toInteger(level, 1));
      return Math.max(10, Math.ceil((current + 1) / 10) * 10);
    }

    static sortFamousPeopleForRoster(people = []) {
      return [...people].sort((a, b) => {
        const rankA = this.getFamousPersonQualityInfo(a?.quality).rank;
        const rankB = this.getFamousPersonQualityInfo(b?.quality).rank;
        if (rankA !== rankB) return rankB - rankA;
        const levelA = this.toInteger(a?.level, 1);
        const levelB = this.toInteger(b?.level, 1);
        if (levelA !== levelB) return levelB - levelA;
        return String(a?.name || '').localeCompare(String(b?.name || ''), 'zh-CN');
      });
    }

    static formatFamousAutoGrowthText(autoAttributeGrowth = {}, attributes = []) {
      const items = (Array.isArray(attributes) ? attributes : [])
        .map((attr, index) => ({
          key: attr.key,
          label: attr.shortLabel || attr.label || attr.key,
          value: Math.max(0, this.toInteger(autoAttributeGrowth?.[attr.key], 0)),
          index,
        }))
        .filter((item) => item.value > 0);
      const total = items.reduce((sum, item) => sum + item.value, 0);
      if (total <= 0) return '';
      const detail = items
        .sort((a, b) => b.value - a.value || a.index - b.index)
        .slice(0, 4)
        .map((item) => `${item.label}+${item.value}`)
        .join(' ');
      return detail
        ? this.t('famous.growth.autoDetail', { total, detail })
        : this.t('famous.growth.auto', { total });
    }

    static buildFamousPersonCard(person = {}, options = {}) {
      const attrs = person.attributes || {};
      const roleLabels = {
        military: this.t('famous.role.military', {}),
        governance: this.t('famous.role.governance', {}),
        knowledge: this.t('famous.role.knowledge', {}),
        charisma: this.t('famous.role.charisma', {}),
      };
      const roles = Array.isArray(person.roles) && person.roles.length
        ? person.roles.map((role) => roleLabels[role] || role).join(' / ')
        : (person.archetypeLabel || this.t('famous.genericRole', {}));
      const attributes = [
        { key: 'command', label: this.t('famous.attribute.command', {}), shortLabel: this.t('famous.attribute.short.command', {}), value: this.toInteger(attrs.command) },
        { key: 'force', label: this.t('famous.attribute.force', {}), shortLabel: this.t('famous.attribute.short.force', {}), value: this.toInteger(attrs.force) },
        { key: 'intelligence', label: this.t('famous.attribute.intelligence', {}), shortLabel: this.t('famous.attribute.short.intelligence', {}), value: this.toInteger(attrs.intelligence ?? attrs.strategy) },
        { key: 'politics', label: this.t('famous.attribute.politics', {}), shortLabel: this.t('famous.attribute.short.politics', {}), value: this.toInteger(attrs.politics ?? attrs.governance) },
        { key: 'charisma', label: this.t('famous.attribute.charisma', {}), shortLabel: this.t('famous.attribute.short.charisma', {}), value: this.toInteger(attrs.charisma) },
        { key: 'speed', label: this.t('famous.attribute.speed', {}), shortLabel: this.t('famous.attribute.short.speed', {}), value: this.toInteger(attrs.speed) },
      ];
      const stats = attributes.map((item) => `${item.shortLabel}${item.value}`).join('  ');
      const abilities = this.getFamousPersonAbilities(person);
      const skills = abilities.length
        ? abilities.map((skill) => this.formatFamousPersonSkill(skill))
        : [this.t('famous.skill.none', {})];
      const skillDetails = abilities.length
        ? abilities.map((skill) => this.formatFamousPersonSkillDetail(skill))
        : [{
          id: 'none',
          name: this.t('famous.skill.none', {}),
          kindText: this.t('famous.skill.generic', {}),
          effectText: this.t('famous.skill.noEffect', {}),
          meta: '',
          description: '',
          summary: this.t('famous.skill.none', {}),
        }];
      const skillBadges = skillDetails.slice(0, 2).map((skill) => ({
        id: skill.id,
        label: skill.kindText || this.t('famous.skill.generic', {}),
        name: skill.name || this.t('famous.skill.generic', {}),
        text: this.t(
          'famous.skill.badge',
          {
            kind: skill.kindText || this.t('famous.skill.generic', {}),
            name: skill.name || this.t('famous.skill.generic', {}),
          }),
      }));
      const isCandidate = Boolean(options.candidate);
      const level = Math.max(1, this.toInteger(person.level, 1));
      const experience = Math.max(0, this.toInteger(person.experience, 0));
      const nextLevelExperience = Math.max(0, this.toInteger(person.nextLevelExperience, 0));
      const freeAttributePoints = Math.max(0, this.toInteger(person.freeAttributePoints, 0));
      const qualityInfo = this.getFamousPersonQualityInfo(person.quality);
      const growthText = !isCandidate
        ? (nextLevelExperience > 0
          ? this.t(
            'famous.growth.experience',
            { level, experience, nextLevelExperience })
          : this.t('famous.growth.level', { level }))
        : '';
      const nextAttributePointLevel = isCandidate ? null : this.getNextFamousAttributePointLevel(level);
      const pointText = !isCandidate
        ? this.t('famous.pointText', { points: freeAttributePoints })
        : '';
      const attributePointHint = !isCandidate
        ? (freeAttributePoints > 0
          ? this.t('famous.attributePoint.available', { points: freeAttributePoints })
          : this.t('famous.attributePoint.next', { level: nextAttributePointLevel }))
        : '';
      const autoGrowthText = !isCandidate ? this.formatFamousAutoGrowthText(person.autoAttributeGrowth, attributes) : '';
      const autoGrowthTotal = !isCandidate
        ? attributes.reduce((sum, item) => sum + Math.max(0, this.toInteger(person.autoAttributeGrowth?.[item.key], 0)), 0)
        : 0;
      const attributeActions = !isCandidate && freeAttributePoints > 0
        ? attributes.map((item) => ({
          type: 'assignFamousAttributePoint',
          personId: person.id || '',
          attribute: item.key,
          disabled: false,
        }))
        : [];
      return {
        id: person.id || '',
        name: person.name || this.t('famous.unknown', {}),
        title: person.title || person.archetypeLabel || this.t('famous.genericTitle', {}),
        quality: qualityInfo.key,
        qualityLabel: person.qualityLabel || qualityInfo.label,
        qualityRank: qualityInfo.rank,
        qualityFrame: qualityInfo.frame,
        roleText: roles,
        sourceText: this.formatFamousPersonSource(person.source),
        level: isCandidate ? null : level,
        experience: isCandidate ? null : experience,
        nextLevelExperience: isCandidate ? null : nextLevelExperience,
        freeAttributePoints: isCandidate ? null : freeAttributePoints,
        nextAttributePointLevel,
        attributePointHint,
        autoGrowthText,
        autoGrowthTotal,
        growthText,
        pointText,
        stats,
        attributes,
        attributeActions,
        skills,
        skillDetails,
        skillBadges,
        appearance: person.appearance && typeof person.appearance === 'object' ? person.appearance : null,
        statusText: options.candidate
          ? this.t('famous.status.candidate', {})
          : (person.status?.assigned === 'idle'
            ? this.t('famous.status.idle', {})
            : this.t('famous.status.assigned', {})),
        openDetailAction: isCandidate ? null : { type: 'openFamousPersonDetail', personId: person.id || '' },
      };
    }

    static buildFamousPersonViewState(state = {}, options = {}) {
      const famous = state.famousPersons || {};
      const people = Array.isArray(famous.people) ? famous.people : [];
      const candidates = Array.isArray(famous.candidates) ? famous.candidates : [];
      const seek = famous.seek || {};
      const candidateCount = this.toInteger(famous.candidateCount ?? candidates.length);
      const maxCandidates = this.toInteger(famous.maxCandidates, 3);
      const seekAvailable = Boolean(seek.available);
      const seekText = seekAvailable
        ? this.t('famous.seek.available', {})
        : this.t('famous.seek.unavailable', {});
      const sortedPeople = this.sortFamousPeopleForRoster(people).map((person) => this.buildFamousPersonCard(person));
      const selectedPersonId = String(options.selectedPersonId || '');
      const selectedPerson = selectedPersonId
        ? sortedPeople.find((person) => person.id === selectedPersonId) || null
        : null;
      return {
        title: this.t('famous.title', {}),
        subtitle: this.t('famous.subtitle', {}),
        peopleCount: this.toInteger(famous.count ?? people.length),
        candidateCount,
        maxCandidates,
        seek: {
          available: seekAvailable,
          text: seekText,
          message: seek.message || (seekAvailable
            ? this.t('famous.seek.message.available', {})
            : this.t('famous.seek.message.locked', {})),
          count: this.toInteger(seek.count),
          action: { type: 'seekFamousPerson', disabled: !seekAvailable },
        },
        people: sortedPeople,
        selectedPerson,
        candidates: candidates.map((person) => ({
          ...this.buildFamousPersonCard(person, { candidate: true }),
          acceptAction: { type: 'acceptFamousPerson', candidateId: person.id },
          dismissAction: { type: 'dismissFamousPersonCandidate', candidateId: person.id },
        })),
        emptyText: this.t('famous.empty', {}),
      };
    }
  }

  global.FamousPersonPresenter = FamousPersonPresenter;
  if (typeof module !== 'undefined' && module.exports) module.exports = FamousPersonPresenter;
})(typeof window !== 'undefined' ? window : globalThis);
