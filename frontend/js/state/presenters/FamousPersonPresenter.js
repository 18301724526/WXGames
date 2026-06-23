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
      return {
        directDamage: '直接伤害',
        secondHit: '二段伤害',
        firstStrike: '先手',
        lifesteal: '吸血',
        combo: '连击',
        counter: '反击',
        shield: '护盾',
        armorBreak: '破甲',
        burn: '灼烧',
        poison: '中毒',
        morale: '士气',
        heal: '治疗',
        ambush: '伏击',
        attributeBonus: '属性修正',
        resourceOutputPct: '资源产出',
        allBasicOutputPct: '基础产出',
        constructionSpeedPct: '建造速度',
        constructionCostPct: '建造消耗',
        knowledgeOutputPct: '知识产出',
        populationCapPct: '人口上限',
        happinessFlat: '幸福度',
        trainingSpeedPct: '训练速度',
        eventRewardPct: '事件收益',
        eventRiskReductionPct: '事件风险',
        settlementPacifyPct: '安抚效率',
        famousRetentionPct: '名人说服',
        diplomacyBonusPct: '外交加成',
        scoutReportBonusPct: '侦查情报',
        cityStabilityPct: '城市稳定',
      };
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
      if (skill.slot === 'activeSkill' || skill.kind === 'active') return '主动战法';
      if (skill.slot === 'passiveTrait') return '战斗被动';
      if (skill.slot === 'civilPrimary') return '内政主技';
      if (skill.slot === 'civilSecondary') return '内政副技';
      if (skill.slot === 'scoutTrait') return '斥候特质';
      if (skill.kind === 'civil') return '内政技能';
      if (skill.kind === 'passive') return '被动特质';
      return '技能';
    }

    static formatFamousPersonCastCondition(condition = {}) {
      const percent = Math.round(Number(condition.value ?? condition.pct ?? 0) * 100);
      const labels = {
        cooldownReady: '',
        targetAlive: '',
        firstOwnAction: '时机：首次出手',
        selfSoldierBelowPct: `发动条件：我方兵力低于 ${percent}%`,
        selfSoldierAbovePct: `发动条件：我方兵力高于 ${percent}%`,
        targetSoldierBelowPct: `发动条件：目标兵力低于 ${percent}%`,
        targetHasStatus: `发动条件：目标带有${condition.status || '指定状态'}`,
        selfHasStatus: `发动条件：我方带有${condition.status || '指定状态'}`,
      };
      return Object.prototype.hasOwnProperty.call(labels, condition.type) ? labels[condition.type] : '';
    }

    static formatFamousPersonCooldownText(cooldown, skill = {}) {
      if (cooldown === null || skill.kind !== 'active') return '';
      if (cooldown <= 0) return '冷却：无';
      return `冷却：${cooldown} 回合`;
    }

    static formatFamousPersonCastRate(skill = {}) {
      if (skill.kind !== 'active') return '';
      const raw = skill.castRate ?? skill.triggerRate ?? skill.probability ?? skill.chance ?? skill.rate;
      const numeric = Number(raw);
      if (!Number.isFinite(numeric)) return '发动率：100%';
      const normalized = numeric > 1 ? numeric / 100 : numeric;
      return `发动率：${Math.max(0, Math.min(100, Math.round(normalized * 100)))}%`;
    }

    static formatFamousPersonEffectSentence(effect = {}, skill = {}) {
      const key = effect?.key || '';
      if (key === 'directDamage') {
        return skill.damageType === 'strategy'
          ? '发动战法攻击目标，造成一次谋略伤害。'
          : '发动战法攻击目标，造成一次兵刃伤害。';
      }
      if (key === 'secondHit') return '造成伤害后追加一次追击（追击：根据本次攻击的一部分伤害再次打击目标）。';
      if (key === 'firstStrike') return '首次出手时抢先压制目标，并追加一次先机打击。';
      if (key === 'lifesteal') return '施加倒戈（倒戈：将敌方本次损失兵力的一部分转换为自己的兵力）。';
      if (key === 'heal') return `恢复我方一部分兵力。`;
      if (key === 'shield') return '获得守御，可抵消一部分伤害。';
      if (key === 'armorBreak') return '对目标施加破甲（破甲：目标后续受到的兵刃伤害提高）。';
      if (key === 'burn') return '对目标施加灼烧（灼烧：目标行动前会损失兵力）。';
      if (key === 'poison') return '对目标施加中毒（中毒：目标行动前会持续损失兵力）。';
      if (key === 'attributeBonus') {
        const attribute = this.getFamousPersonAttributeLabel(effect.attribute || effect.keyAttribute);
        const value = Math.round(Number(effect.value) || 0);
        if (skill.kind === 'passive' || skill.slot === 'passiveTrait') {
          return `战斗开始前，自己的${attribute}提高 ${value} 点。`;
        }
        return `发动后，本场战斗中自己的${attribute}提高 ${value} 点。`;
      }
      if (key === 'resourceOutputPct') return `${effect.resource === 'food' ? '粮食' : '资源'}产出提高 ${this.formatFamousPersonPercent(effect.value)}。`;
      if (key === 'allBasicOutputPct') return `基础资源产出提高 ${this.formatFamousPersonPercent(effect.value)}。`;
      if (key === 'constructionSpeedPct') return `建造速度提高 ${this.formatFamousPersonPercent(effect.value)}。`;
      if (key === 'constructionCostPct') return `建造消耗降低 ${this.formatFamousPersonPercent(effect.value)}。`;
      if (key === 'knowledgeOutputPct') return `知识产出提高 ${this.formatFamousPersonPercent(effect.value)}。`;
      if (key === 'populationCapPct') return `人口上限提高 ${this.formatFamousPersonPercent(effect.value)}。`;
      if (key === 'happinessFlat') return `幸福度提高 ${Math.round(Number(effect.value) || 0)} 点。`;
      if (key === 'trainingSpeedPct') return `训练速度提高 ${this.formatFamousPersonPercent(effect.value)}。`;
      if (key === 'eventRewardPct') return `事件奖励提高 ${this.formatFamousPersonPercent(effect.value)}。`;
      if (key === 'eventRiskReductionPct') return `事件风险降低 ${this.formatFamousPersonPercent(effect.value)}。`;
      if (key === 'settlementPacifyPct') return `安抚效率提高 ${this.formatFamousPersonPercent(effect.value)}。`;
      if (key === 'famousRetentionPct') return `名人说服成功率提高 ${this.formatFamousPersonPercent(effect.value)}。`;
      if (key === 'diplomacyBonusPct') return `外交收益提高 ${this.formatFamousPersonPercent(effect.value)}。`;
      if (key === 'scoutReportBonusPct') return `侦查情报质量提高 ${this.formatFamousPersonPercent(effect.value)}。`;
      if (key === 'cityStabilityPct') return `城市稳定提高 ${this.formatFamousPersonPercent(effect.value)}。`;
      return '';
    }

    static buildFamousPersonSkillDescription(skill = {}) {
      const effects = Array.isArray(skill.effects) ? skill.effects : [];
      if (!effects.length) return '暂无具体效果。';
      const hasDirectDamage = effects.some((effect) => effect?.key === 'directDamage');
      const hasLifesteal = effects.some((effect) => effect?.key === 'lifesteal');
      if (hasDirectDamage && hasLifesteal) {
        const damageText = skill.damageType === 'strategy' ? '谋略伤害' : '兵刃伤害';
        return `发动战法攻击目标，造成一次${damageText}，并施加倒戈（倒戈：将敌方本次损失兵力的一部分转换为自己的兵力）。`;
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
      const effectText = effects.length ? effects.join(' / ') : '暂无效果';
      const cooldownText = this.formatFamousPersonCooldownText(cooldown, skill);
      const castRateText = this.formatFamousPersonCastRate(skill);
      const triggerText = skill.trigger === 'preBattle'
        ? '时机：战斗开始'
        : (skill.trigger === 'passiveStored' ? '状态：已加入名人档案' : conditions.join(' · '));
      const statusText = skill.implementationStatus === 'storedOnly' ? '暂未接入实际收益' : '';
      const meta = [cooldownText, castRateText, triggerText, statusText].filter(Boolean).join(' · ');
      const description = this.sanitizeFamousPersonSkillDescription(skill) || this.buildFamousPersonSkillDescription(skill);
      return {
        id: skill.id || skill.name || '',
        name: skill.name || '技能',
        kindText,
        effectText,
        meta,
        description,
        summary: `${skill.name || '技能'} · ${description}`,
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
