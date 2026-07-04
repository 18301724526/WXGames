(function (global) {
  const LocaleText = (() => {
    if (global.LocaleText) return global.LocaleText;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../../ecs/resource/LocaleText');
      } catch (_error) {
        return null;
      }
    }
    return null;
  })();

  class WorldSitePresenter {
    static toNumber(value, fallback = 0) {
      const number = Number(value);
      return Number.isFinite(number) ? number : fallback;
    }

    static toInteger(value, fallback = 0) {
      return Math.floor(this.toNumber(value, fallback));
    }

    static t(key = '', params = {}) {
      return LocaleText ? LocaleText.t(key, params) : key;
    }

    static formatWorldSiteEffect(effects = {}) {
      const parts = [];
      if (effects.foodOutputMultiplier) {
        parts.push(this.t('world.site.effect.foodOutputMultiplier', {
          percent: Math.round(effects.foodOutputMultiplier * 100),
        }));
      }
      if (effects.woodOutputMultiplier) {
        parts.push(this.t('world.site.effect.woodOutputMultiplier', {
          percent: Math.round(effects.woodOutputMultiplier * 100),
        }));
      }
      if (effects.knowledgeOutputMultiplier) {
        parts.push(this.t('world.site.effect.knowledgeOutputMultiplier', {
          percent: Math.round(effects.knowledgeOutputMultiplier * 100),
        }));
      }
      if (effects.threatDefense) parts.push(this.t('world.site.effect.threatDefense', { value: effects.threatDefense }));
      return parts.join(this.t('common.inlineSeparator')) || this.t('world.site.summary.none');
    }

    static formatWorldSiteStatus(site = {}) {
      const labels = {
        discovered: this.t('world.site.status.discovered'),
        contested: this.t('world.site.status.contested'),
        occupied: this.t('world.site.status.occupied'),
      };
      return labels[site.status] || site.status || '';
    }

    static formatWorldSiteOwner(site = {}) {
      if (site.owner === 'player') return this.t('world.site.owner.player');
      if (site.owner === 'neutral') return this.t('world.site.owner.neutral');
      const labels = {
        tribe: this.t('world.site.owner.tribe'),
        city_state: this.t('world.site.owner.cityState'),
        ruin_guardians: this.t('world.site.owner.ruinGuardians'),
      };
      const ownerLabel = labels[site.owner] || site.owner || this.t('world.site.owner.unknownForce');
      return this.t('world.site.owner.owned', { owner: ownerLabel });
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
        return totalSeconds > 0
          ? this.t('world.site.march.readyTimed', { duration: this.formatWorldDuration(totalSeconds) })
          : this.t('world.site.march.ready');
      }
      if (site.status === 'contested') {
        const remaining = this.formatWorldDuration(mission?.remainingSeconds || 0);
        return totalSeconds > 0
          ? this.t('world.site.march.remainingTimed', {
            duration: this.formatWorldDuration(totalSeconds),
            remaining,
          })
          : this.t('world.site.march.remaining', { remaining });
      }
      if (site.status === 'discovered' && totalSeconds > 0) {
        return this.t('world.site.march.duration', { duration: this.formatWorldDuration(totalSeconds) });
      }
      return '';
    }

    static buildWorldExpeditionDraftViewState(site = {}, uiState = {}, famousPersons = {}) {
      const recommended = Math.max(1, Number(site?.recommendedSoldiers) || Number(site?.defense) || 1);
      const people = Array.isArray(famousPersons.people) ? famousPersons.people : [];
      const firstLeader = people.find((person) => Array.isArray(person.roles) && person.roles.includes('military')) || null;
      return {
        territoryId: uiState.expeditionConfigSiteId || '',
        troopType: uiState.expeditionTroopType || 'unavailable',
        leader: uiState.expeditionLeader || firstLeader?.id || 'unavailable',
        soldiers: Math.max(1, Number(uiState.expeditionSoldiers) || recommended),
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
          label: `${person.name || this.t('world.site.person.unknown')} · ${person.title || person.archetypeLabel || this.t('world.site.person.famous')}`,
        }));
      const leaderOptions = militaryLeaders.length ? militaryLeaders : [{ value: 'unavailable', label: this.t('world.site.person.unnamedLeader') }];
      const hasLeader = leaderOptions.some((option) => option.value === draft.leader);
      return {
        siteId: site.id || '',
        draft,
        availableSoldiers,
        disabled: availableSoldiers < draft.soldiers || !hasLeader,
        note: this.t('world.site.expedition.note', {
          recommended: draft.recommended,
          available: availableSoldiers,
        }),
        fields: {
          troopType: {
            label: this.t('world.site.expedition.troopType'),
            value: draft.troopType,
            options: [{ value: 'unavailable', label: this.t('world.site.expedition.unavailable') }],
            note: this.t('world.site.expedition.unavailable'),
          },
          leader: {
            label: this.t('world.site.expedition.leader'),
            value: draft.leader,
            options: leaderOptions,
            note: militaryLeaders.length
              ? this.t('world.site.expedition.leaderNote.ready')
              : this.t('world.site.expedition.leaderNote.placeholder'),
          },
          soldiers: {
            label: this.t('world.site.expedition.soldiers'),
            value: draft.soldiers,
            min: 1,
            step: 1,
          },
        },
        buttons: {
          cancel: { label: this.t('world.site.action.cancel'), action: 'close-expedition' },
          launch: { label: this.t('world.site.action.launch'), action: 'launch-expedition' },
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

    static buildWorldSiteActionViewState(site = {}, territoryState = {}, uiState = {}) {
      const mission = site.mission || null;
      if (site.status === 'discovered') {
        const isOwnedTarget = site.occupationMode === 'conquest';
        const expanded = uiState.expeditionConfigSiteId === site.id;
        return {
          kind: 'group',
          buttons: [
            this.makeWorldSiteActionButton(this.t('world.site.action.trade'), '', site.id, { disabled: true, secondary: true }),
            this.makeWorldSiteActionButton(this.t('world.site.action.plunder'), '', site.id, { disabled: true, secondary: true }),
            this.makeWorldSiteActionButton(this.t('world.site.action.conquer'), isOwnedTarget ? 'open-expedition' : 'conquer', site.id),
          ],
          hint: isOwnedTarget ? this.t('world.site.hint.conquestOwned') : this.t('world.site.hint.freeSettlement'),
          expeditionConfig: isOwnedTarget && expanded
            ? this.buildWorldExpeditionConfigViewState(site, territoryState, uiState)
            : null,
        };
      }
      if (site.status === 'contested' && mission?.status === 'ready') {
        const action = mission.mode === 'settlement' ? 'claim' : 'enter-battle';
        return {
          kind: 'single',
          buttons: [this.makeWorldSiteActionButton(action === 'claim' ? this.t('world.site.action.claim') : this.t('world.site.action.enterBattle'), action, site.id)],
          hint: '',
          expeditionConfig: null,
        };
      }
      if (site.status === 'contested') {
        return {
          kind: 'single',
          buttons: [this.makeWorldSiteActionButton(this.t('world.site.action.marching'), '', site.id, { disabled: true })],
          hint: '',
          expeditionConfig: null,
        };
      }
      if (site.status === 'occupied') {
        return {
          kind: 'city-command',
          buttons: [
            this.makeWorldSiteActionButton(this.t('world.site.action.enterCity'), 'enter-city', site.id),
            this.makeWorldSiteActionButton(this.t('world.site.action.marchCity'), 'march-city', site.id, { disabled: true, secondary: true }),
            this.makeWorldSiteActionButton(this.t('world.site.action.transferCity'), 'transfer-city', site.id, { disabled: true, secondary: true }),
            this.makeWorldSiteActionButton(this.t('world.site.action.garrisonCity'), 'garrison-city', site.id, { disabled: true, secondary: true }),
            this.makeWorldSiteActionButton(this.t('world.site.action.laborCity'), 'labor-city', site.id, { secondary: true }),
            this.makeWorldSiteActionButton(this.t('world.site.action.rename'), 'rename-city', site.id, { secondary: true }),
          ],
          hint: this.t('world.site.hint.occupied'),
          expeditionConfig: null,
        };
      }
      return {
        kind: 'single',
        buttons: [this.makeWorldSiteActionButton(this.t('world.site.action.waitScout'), '', site.id, { disabled: true })],
        hint: '',
        expeditionConfig: null,
      };
    }

    static getWorldSiteLastBattleNote(site = {}) {
      if (!site.lastBattle) return '';
      if (site.lastBattle.mode === 'settlement') return this.t('world.site.battle.settlementSuccess');
      const result = site.lastBattle.success ? this.t('world.site.battle.lastSuccess') : this.t('world.site.battle.lastFailure');
      const leader = site.lastBattle.leaderName
        ? this.t('world.site.battle.leaderSuffix', { leader: site.lastBattle.leaderName })
        : '';
      return `${result}${leader}${this.t('world.site.battle.casualties', { casualties: site.lastBattle.casualties || 0 })}`;
    }

    static getWorldSiteBattleReportLines(site = {}) {
      const report = site.lastBattle?.report;
      if (!report) return [];
      const lines = [report.summary || this.t('world.site.battle.ended')];
      if (['speed-basic-attack-v1', 'speed-skill-cooldown-v1', 'attribute-auto-battle-v1', 'attribute-auto-battle-v2'].includes(report.system)) {
        lines.push(this.t('world.site.battle.speedLine', {
          attackerSpeed: report.attacker?.speed || 0,
          defenderSpeed: report.defender?.speed || 0,
        }));
        if (report.moraleEffectEnabled === false) lines.push(this.t('world.site.battle.moraleRecorded'));
      } else if (report.skillName) lines.push(this.t('world.site.battle.keySkill', { skill: report.skillName }));
      const lastRound = Array.isArray(report.rounds) && report.rounds.length ? report.rounds[report.rounds.length - 1] : null;
      if (lastRound) {
        lines.push(this.t('world.site.battle.finalSoldiers', {
          attackerSoldiers: lastRound.attackerSoldiers || 0,
          defenderSoldiers: lastRound.defenderSoldiers || 0,
        }));
      } else if (report.attacker || report.defender) {
        lines.push(this.t('world.site.battle.finalSoldiers', {
          attackerSoldiers: report.attacker?.soldiersEnd || 0,
          defenderSoldiers: report.defender?.soldiersEnd || 0,
        }));
      }
      return lines.slice(0, 4);
    }

    static getWorldSiteDefenderLeaderLine(site = {}) {
      const leader = site.garrison?.leader || site.defenderLeader;
      if (!leader || typeof leader !== 'object') return '';
      const title = leader.title ? ` · ${leader.title}` : '';
      const quality = leader.qualityLabel ? ` · ${leader.qualityLabel}` : '';
      return this.t('world.site.defender.leader', {
        name: leader.name || this.t('world.site.defender.unknownName'),
        title,
        quality,
      });
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
      return this.t('world.site.defender.skill', {
        skill: skill.name || this.t('world.site.defender.unknownSkill'),
      });
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
          distance: this.t('world.site.metric.distance', { value: site.originDistance ?? site.distance ?? 0 }),
          scale: this.t('world.site.metric.scale', { value: site.scale || 1 }),
          threat: this.t('world.site.metric.threat', { value: site.threat || 0 }),
          summary: site.summary || this.formatWorldSiteEffect(site.effects),
          defense: this.t('world.site.metric.defense', { value: site.defense || 0 }),
          soldiers: this.t('world.site.metric.recommendedSoldiers', { soldiers: site.recommendedSoldiers || 0 }),
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
