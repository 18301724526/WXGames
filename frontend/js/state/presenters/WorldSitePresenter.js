(function (global) {
  class WorldSitePresenter {
    static MIN_EXPEDITION_SOLDIERS = 100;
    static TUTORIAL_SCOUT_EXPLORE_CLAIMED_STEP = 25;
    static TUTORIAL_FIRST_CITY_CONQUEST_STARTED_STEP = 26;

    static toNumber(value, fallback = 0) {
      const number = Number(value);
      return Number.isFinite(number) ? number : fallback;
    }

    static toInteger(value, fallback = 0) {
      return Math.floor(this.toNumber(value, fallback));
    }

    static formatWorldSiteEffect(effects = {}) {
      const parts = [];
      if (effects.foodOutputMultiplier) parts.push(`食物 +${Math.round(effects.foodOutputMultiplier * 100)}%`);
      if (effects.woodOutputMultiplier) parts.push(`木材 +${Math.round(effects.woodOutputMultiplier * 100)}%`);
      if (effects.knowledgeOutputMultiplier) parts.push(`知识 +${Math.round(effects.knowledgeOutputMultiplier * 100)}%`);
      if (effects.threatDefense) parts.push(`边境防御 +${effects.threatDefense}`);
      return parts.join('，') || '无';
    }

    static formatWorldSiteStatus(site = {}) {
      const labels = {
        discovered: '已发现',
        contested: '出征中',
        occupied: '已控制',
      };
      return labels[site.status] || site.status || '';
    }

    static formatWorldSiteOwner(site = {}) {
      if (site.owner === 'player') return '我方';
      if (site.owner === 'neutral') return '无主';
      const labels = {
        tribe: '部落',
        city_state: '城邦',
        ruin_guardians: '遗迹守军',
      };
      const ownerLabel = labels[site.owner] || site.owner || '未知势力';
      return `有主 · ${ownerLabel}`;
    }

    static formatWorldDuration(seconds) {
      const value = Math.max(0, Math.ceil(Number(seconds) || 0));
      const minutes = Math.floor(value / 60);
      const rest = value % 60;
      return `${minutes}:${String(rest).padStart(2, '0')}`;
    }

    static getWorldSiteMarchInfo(site = {}, territoryState = {}) {
      const mission = site.mission || null;
      const totalSeconds = Math.max(0, Math.floor(mission?.durationSeconds || territoryState.missionDurationSeconds || 0));
      if (site.status === 'contested' && mission?.status === 'ready') {
        return totalSeconds > 0 ? `行军耗时 ${this.formatWorldDuration(totalSeconds)}，已抵达待接管` : '已抵达待接管';
      }
      if (site.status === 'contested') {
        const remaining = this.formatWorldDuration(mission?.remainingSeconds || 0);
        return totalSeconds > 0 ? `行军耗时 ${this.formatWorldDuration(totalSeconds)}，剩余 ${remaining}` : `剩余 ${remaining}`;
      }
      if (site.status === 'discovered' && totalSeconds > 0) {
        return `行军耗时 ${this.formatWorldDuration(totalSeconds)}`;
      }
      return '';
    }

    static buildWorldExpeditionDraftViewState(site = {}, uiState = {}, famousPersons = {}) {
      const recommended = Math.max(this.MIN_EXPEDITION_SOLDIERS, Number(site?.recommendedSoldiers) || Number(site?.defense) || this.MIN_EXPEDITION_SOLDIERS);
      const people = Array.isArray(famousPersons.people) ? famousPersons.people : [];
      const firstLeader = people.find((person) => Array.isArray(person.roles) && person.roles.includes('military')) || null;
      return {
        territoryId: uiState.expeditionConfigSiteId || '',
        troopType: uiState.expeditionTroopType || 'unavailable',
        leader: uiState.expeditionLeader || firstLeader?.id || 'unavailable',
        soldiers: Math.max(this.MIN_EXPEDITION_SOLDIERS, Number(uiState.expeditionSoldiers) || recommended),
        recommended,
      };
    }

    static buildWorldExpeditionConfigViewState(site = {}, territoryState = {}, uiState = {}) {
      const draft = this.buildWorldExpeditionDraftViewState(site, uiState, territoryState.famousPersons || {});
      const availableSoldiers = this.toInteger(territoryState.availableSoldiers);
      const famousPeople = Array.isArray(territoryState.famousPersons?.people) ? territoryState.famousPersons.people : [];
      const militaryLeaders = famousPeople
        .filter((person) => Array.isArray(person.roles) && person.roles.includes('military'))
        .map((person) => ({
          value: person.id,
          label: `${person.name || '无名之士'} · ${person.title || person.archetypeLabel || '名人'}`,
        }));
      const leaderOptions = militaryLeaders.length ? militaryLeaders : [{ value: 'unavailable', label: '无名领队' }];
      const hasLeader = leaderOptions.some((option) => option.value === draft.leader);
      return {
        siteId: site.id || '',
        draft,
        availableSoldiers,
        disabled: availableSoldiers < draft.soldiers || !hasLeader,
        note: `建议 ${site.recommendedSoldiers || site.defense || this.MIN_EXPEDITION_SOLDIERS} 士兵，当前可用 ${availableSoldiers} 士兵`,
        fields: {
          troopType: {
            label: '兵种',
            value: draft.troopType,
            options: [{ value: 'unavailable', label: '暂未开放' }],
            note: '暂未开放',
          },
          leader: {
            label: '领队',
            value: draft.leader,
            options: leaderOptions,
            note: militaryLeaders.length ? '选择一位名人作为领队' : '临时领队可出征，接纳军事名人后会形成战报特色',
          },
          soldiers: {
            label: '出征数量',
            value: draft.soldiers,
            min: this.MIN_EXPEDITION_SOLDIERS,
            step: this.MIN_EXPEDITION_SOLDIERS,
          },
        },
        buttons: {
          cancel: { label: '取消', action: 'close-expedition' },
          launch: { label: '出发', action: 'launch-expedition' },
        },
      };
    }

    static makeWorldSiteActionButton(label, action, territoryId, options = {}) {
      return {
        label,
        action: action || '',
        territoryId: territoryId || '',
        disabled: Boolean(options.disabled),
        secondary: Boolean(options.secondary),
      };
    }

    static isGuidedFirstCitySettlement(site = {}, territoryState = {}, uiState = {}) {
      const tutorial = territoryState.tutorial || uiState.tutorial || {};
      if (tutorial.completed || tutorial.disabled) return false;
      const step = this.toInteger(tutorial.currentStep, -1);
      if (
        step < this.TUTORIAL_SCOUT_EXPLORE_CLAIMED_STEP
        || step >= this.TUTORIAL_FIRST_CITY_CONQUEST_STARTED_STEP
      ) {
        return false;
      }
      const grantSiteId = tutorial.grants?.firstExploreEmptyCity?.siteId;
      if (!grantSiteId || String(grantSiteId) !== String(site.id || '')) return false;
      return site.status === 'discovered' && site.owner === 'neutral';
    }

    static buildWorldSiteActionViewState(site = {}, territoryState = {}, uiState = {}) {
      const availableSoldiers = this.toInteger(territoryState.availableSoldiers);
      const mission = site.mission || null;
      if (site.status === 'discovered') {
        const isOwnedTarget = site.occupationMode === 'conquest';
        const expanded = uiState.expeditionConfigSiteId === site.id;
        const directDisabled = availableSoldiers < this.MIN_EXPEDITION_SOLDIERS
          && !this.isGuidedFirstCitySettlement(site, territoryState, uiState);
        return {
          kind: 'group',
          buttons: [
            this.makeWorldSiteActionButton('交涉', '', site.id, { disabled: true, secondary: true }),
            this.makeWorldSiteActionButton('掠夺', '', site.id, { disabled: true, secondary: true }),
            this.makeWorldSiteActionButton('占领', isOwnedTarget ? 'open-expedition' : 'conquer', site.id, {
              disabled: !isOwnedTarget && directDisabled,
            }),
          ],
          hint: isOwnedTarget ? '该地区已有势力，需要先配置出征队伍。' : '该地区无主，派出 100 士兵即可建立据点。',
          expeditionConfig: isOwnedTarget && expanded
            ? this.buildWorldExpeditionConfigViewState(site, territoryState, uiState)
            : null,
        };
      }
      if (site.status === 'contested' && mission?.status === 'ready') {
        const action = mission.mode === 'settlement' ? 'claim' : 'enter-battle';
        return {
          kind: 'single',
          buttons: [this.makeWorldSiteActionButton(action === 'claim' ? '完成占领' : '进入战斗', action, site.id)],
          hint: '',
          expeditionConfig: null,
        };
      }
      if (site.status === 'contested') {
        return {
          kind: 'single',
          buttons: [this.makeWorldSiteActionButton('行军中', '', site.id, { disabled: true })],
          hint: '',
          expeditionConfig: null,
        };
      }
      if (site.status === 'occupied') {
        return {
          kind: 'city-command',
          buttons: [
            this.makeWorldSiteActionButton('入城', 'enter-city', site.id),
            this.makeWorldSiteActionButton('行军', 'march-city', site.id, { disabled: true, secondary: true }),
            this.makeWorldSiteActionButton('调动', 'transfer-city', site.id, { disabled: true, secondary: true }),
            this.makeWorldSiteActionButton('驻守', 'garrison-city', site.id, { disabled: true, secondary: true }),
            this.makeWorldSiteActionButton('佣工', 'labor-city', site.id, { secondary: true }),
            this.makeWorldSiteActionButton('改名', 'rename-city', site.id, { secondary: true }),
          ],
          hint: '选择入城进入建设、人口与驻军管理；行军、调动、驻守后续接军团系统。',
          expeditionConfig: null,
        };
      }
      return {
        kind: 'single',
        buttons: [this.makeWorldSiteActionButton('等待侦察', '', site.id, { disabled: true })],
        hint: '',
        expeditionConfig: null,
      };
    }

    static getWorldSiteLastBattleNote(site = {}) {
      if (!site.lastBattle) return '';
      if (site.lastBattle.mode === 'settlement') return '最近一次行动已顺利建立据点';
      const result = site.lastBattle.success ? '上次占领成功' : '上次占领失败';
      const leader = site.lastBattle.leaderName ? ` · ${site.lastBattle.leaderName}率队` : '';
      return `${result}${leader} · 损失 ${site.lastBattle.casualties || 0} 士兵`;
    }

    static getWorldSiteBattleReportLines(site = {}) {
      const report = site.lastBattle?.report;
      if (!report) return [];
      const lines = [report.summary || '战斗已经结束。'];
      if (['speed-basic-attack-v1', 'speed-skill-cooldown-v1', 'attribute-auto-battle-v1', 'attribute-auto-battle-v2'].includes(report.system)) {
        lines.push(`速度：己方 ${report.attacker?.speed || 0} / 敌方 ${report.defender?.speed || 0}`);
        if (report.moraleEffectEnabled === false) lines.push('士气：已记录，暂不影响伤害');
      } else if (report.skillName) lines.push(`关键技能：${report.skillName}`);
      const lastRound = Array.isArray(report.rounds) && report.rounds.length ? report.rounds[report.rounds.length - 1] : null;
      if (lastRound) {
        lines.push(`终局兵力：己方 ${lastRound.attackerSoldiers || 0} / 敌方 ${lastRound.defenderSoldiers || 0}`);
      } else if (report.attacker || report.defender) {
        lines.push(`终局兵力：己方 ${report.attacker?.soldiersEnd || 0} / 敌方 ${report.defender?.soldiersEnd || 0}`);
      }
      return lines.slice(0, 4);
    }

    static getWorldSiteDefenderLeaderLine(site = {}) {
      const leader = site.garrison?.leader || site.defenderLeader;
      if (!leader || typeof leader !== 'object') return '';
      const title = leader.title ? ` · ${leader.title}` : '';
      const quality = leader.qualityLabel ? ` · ${leader.qualityLabel}` : '';
      return `守将 ${leader.name || '未知'}${title}${quality}`;
    }

    static getWorldSiteDefenderSkillLine(site = {}) {
      const leader = site.garrison?.leader || site.defenderLeader;
      if (!leader || typeof leader !== 'object') return '';
      const active = Array.isArray(leader.abilityKit?.abilities)
        ? leader.abilityKit.abilities.find((ability) => ability?.slot === 'activeSkill' || ability?.kind === 'active')
        : null;
      const fallback = Array.isArray(leader.skills) ? leader.skills[0] : null;
      const skill = active || fallback;
      if (!skill) return '';
      return `敌方战法 ${skill.name || '未知战法'}`;
    }

    static buildWorldSiteDetailViewState(site = {}, territoryState = {}, uiState = {}) {
      const selectedSiteId = uiState.selectedSiteId || '';
      return {
        id: site.id || '',
        visible: site.id === selectedSiteId,
        text: {
          name: site.cityName || site.naturalName || '',
          status: this.formatWorldSiteStatus(site),
          owner: this.formatWorldSiteOwner(site),
          distance: `距 ${site.originDistance ?? site.distance ?? 0}`,
          scale: `规模 ${site.scale || 1}`,
          threat: `威胁 ${site.threat || 0}`,
          summary: site.summary || this.formatWorldSiteEffect(site.effects),
          defense: `防御 ${site.defense || 0}`,
          soldiers: `建议 ${site.recommendedSoldiers || 0} 士兵`,
          defenderLeader: this.getWorldSiteDefenderLeaderLine(site),
          defenderSkill: this.getWorldSiteDefenderSkillLine(site),
          march: this.getWorldSiteMarchInfo(site, territoryState),
          note: this.getWorldSiteLastBattleNote(site),
          battleReport: this.getWorldSiteBattleReportLines(site),
        },
        action: this.buildWorldSiteActionViewState(site, territoryState, uiState),
      };
    }

    static buildWorldSiteDialogViewState(territories = [], territoryState = {}, uiState = {}) {
      const selectedSiteId = uiState.selectedSiteId || '';
      const details = (territories || []).map((site) => this.buildWorldSiteDetailViewState(site, territoryState, uiState));
      const view = {
        selectedSiteId,
        showModal: details.some((detail) => detail.id === selectedSiteId),
        details,
      };
      return {
        ...view,
        signature: JSON.stringify(view),
      };
    }

    static getWorldSiteDialogContentSignature(territories = [], territoryState = {}, uiState = {}) {
      return this.buildWorldSiteDialogViewState(territories, territoryState, uiState).signature;
    }
  }

  global.WorldSitePresenter = WorldSitePresenter;
  if (typeof module !== 'undefined' && module.exports) module.exports = WorldSitePresenter;
})(typeof window !== 'undefined' ? window : globalThis);
