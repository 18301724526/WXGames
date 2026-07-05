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

  const FamousPersonPresenter = (() => {
    if (global.FamousPersonPresenter) return global.FamousPersonPresenter;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('./FamousPersonPresenter');
      } catch (error) {
        return null;
      }
    }
    return null;
  })();

  class MilitaryPresenter {
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

    static buildFamousPersonCard(person = {}) {
      if (FamousPersonPresenter && typeof FamousPersonPresenter.buildFamousPersonCard === 'function') {
        return FamousPersonPresenter.buildFamousPersonCard(person);
      }
      return { ...person };
    }

    static sortFamousPeopleForRoster(people = []) {
      if (FamousPersonPresenter && typeof FamousPersonPresenter.sortFamousPeopleForRoster === 'function') {
        return FamousPersonPresenter.sortFamousPeopleForRoster(people);
      }
      return [...people];
    }

    static normalizeSoldierAssignments(assignments = {}, memberIds = [], cap = 1000) {
      const result = {};
      const max = Math.max(0, this.toInteger(cap, 1000));
      (Array.isArray(memberIds) ? memberIds : []).forEach((memberId) => {
        const id = String(memberId || '').trim();
        if (!id) return;
        result[id] = Math.max(0, Math.min(max, this.toInteger(assignments?.[id], 0)));
      });
      return result;
    }

    static sumSoldierAssignments(assignments = {}) {
      return Object.values(assignments && typeof assignments === 'object' ? assignments : {})
        .reduce((sum, value) => sum + Math.max(0, this.toInteger(value, 0)), 0);
    }

    static buildMilitaryNavigationViewState(state = {}) {
      const requestedView = ['army', 'scout', 'world', 'veteranCamp'].includes(state.militaryView) ? state.militaryView : 'army';
      const activeView = requestedView;
      const views = ['army', 'scout', 'world', 'veteranCamp'].map((id) => ({
        id,
        isActive: id === activeView,
        disabled: false,
        isLocked: false,
        title: '',
        ariaSelected: String(id === activeView),
      }));
      return {
        activeView,
        locked: false,
        views,
      };
    }

    static buildMilitaryViewState(state = {}) {
      const military = state.military || {};
      const soldiers = this.toInteger(military.soldiers);
      const cap = this.toInteger(military.soldierCap);
      const defense = this.toInteger((military.defense || 0) + (state.buildingEffects?.threatDefense || 0));
      const interval = this.toInteger(military.trainingIntervalSeconds);
      const progress = this.toInteger(military.trainingProgress);
      const batchSize = this.toInteger(military.trainingBatchSize, 1);
      const availableSoldiers = this.toInteger(state.territoryState?.availableSoldiers ?? military.availableSoldiers ?? soldiers);
      const soldiersOnMission = this.toInteger(state.territoryState?.soldiersOnMission ?? military.soldiersOnMission ?? 0);
      const cityId = state.activeCityId || state.cityState?.activeCityId || 'capital';
      const people = Array.isArray(state.famousPersons?.people) ? state.famousPersons.people : [];
      const peopleById = new Map(people.map((person) => [person.id, person]));
      const rawFormations = military.formations && typeof military.formations === 'object' ? military.formations : {};
      // Owned shape: a plain 3-slot array (server military is city-scoped); the keyed
      // arm only reads legacy double-keyed payloads from older servers.
      const cityFormations = Array.isArray(rawFormations)
        ? rawFormations
        : Array.isArray(rawFormations[cityId])
          ? rawFormations[cityId]
          : [];
      const maxFormationMembers = 5;
      const formationNames = [
        this.t('military.formation.default.1', {}),
        this.t('military.formation.default.2', {}),
        this.t('military.formation.default.3', {}),
      ];
      const formations = [1, 2, 3].map((slot) => {
        const rawFormation = cityFormations.find((item) => Number(item?.slot) === slot) || cityFormations[slot - 1] || {};
        const memberIds = Array.isArray(rawFormation.memberIds) ? rawFormation.memberIds : [];
        const maxSoldiersPerMember = Math.max(0, this.toInteger(rawFormation.maxSoldiersPerMember, 1000));
        const soldierAssignments = this.normalizeSoldierAssignments(
          rawFormation.soldierAssignments || rawFormation.memberSoldiers || {},
          memberIds,
          maxSoldiersPerMember,
        );
        const soldiersAssigned = this.toInteger(rawFormation.soldiersAssigned, this.sumSoldierAssignments(soldierAssignments));
        const members = memberIds
          .map((personId) => peopleById.get(personId))
          .filter(Boolean)
          .map((person) => ({
            ...this.buildFamousPersonCard(person),
            soldiersAssigned: soldierAssignments[person.id] || 0,
            maxSoldiers: maxSoldiersPerMember,
          }));
        return {
          slot,
          cityId,
          name: rawFormation.name || formationNames[slot - 1] || this.t('military.formation.default', { slot }),
          memberIds: members.map((member) => member.id),
          members,
          leader: members[0] || null,
          memberCount: members.length,
          maxMembers: maxFormationMembers,
          maxSoldiersPerMember,
          soldierAssignments,
          soldiersAssigned,
          isEmpty: members.length === 0,
        };
      });
      const formationPeople = this.sortFamousPeopleForRoster(people).map((person) => this.buildFamousPersonCard(person));

      let trainingText = this.t(
        'military.training.nextBatch',
        { batchSize, progress, interval });
      let trainingProgressWidth = interval > 0
        ? `${Math.max(0, Math.min(100, Math.floor((progress / interval) * 100)))}%`
        : '0%';

      if (soldiers >= cap && cap > 0) {
        trainingText = this.t('military.training.full', {});
        trainingProgressWidth = '100%';
      } else if (cap <= 0 || interval <= 0) {
        trainingText = this.t('military.training.waitBarracks', {});
        trainingProgressWidth = '0%';
      }

      return {
        text: {
          soldierCount: `${soldiers}/${cap}`,
          militaryDefense: defense,
          availableSoldierCount: availableSoldiers,
          soldiersOnMission,
          soldierTrainingText: trainingText,
        },
        training: {
          progressWidth: trainingProgressWidth,
        },
        formations,
        formationPeople,
        formationMeta: {
          cityId,
          maxSlots: 3,
          maxMembers: maxFormationMembers,
          availableReserveSoldiers: soldiers,
          perMemberSoldierCap: 1000,
          summary: this.t(
            'military.formation.summary',
            { maxMembers: maxFormationMembers }),
        },
      };
    }

    static formatDurationShort(seconds) {
      const total = Math.max(0, Math.ceil(this.toNumber(seconds)));
      if (total >= 3600) {
        const hours = Math.floor(total / 3600);
        const mins = Math.floor((total % 3600) / 60);
        return mins > 0 ? `${hours}h${mins}m` : `${hours}h`;
      }
      if (total >= 60) {
        const mins = Math.floor(total / 60);
        const rest = total % 60;
        return rest > 0 ? `${mins}m${rest}s` : `${mins}m`;
      }
      return `${total}s`;
    }

    // 老兵营地 view: the client reads the projected veteranCamp view off the active city DTO
    // (parkedTotal / capacity / batches[drainEtaMs] / nextLevel), never the raw military.
    static buildVeteranCampViewState(state = {}) {
      const cityId = state.activeCityId || state.cityState?.activeCityId || 'capital';
      const cities = Array.isArray(state.cityState?.cities) ? state.cityState.cities : [];
      const activeCity = cities.find((city) => city.id === cityId) || null;
      const camp = activeCity?.veteranCamp || {};
      const level = this.toInteger(camp.level);
      const capacity = this.toInteger(camp.capacity);
      const parkedTotal = this.toInteger(camp.parkedTotal);
      const retentionHours = this.toNumber(camp.retentionHours);
      const batches = Array.isArray(camp.batches) ? camp.batches : [];
      const nextLevel = camp.nextLevel && typeof camp.nextLevel === 'object'
        ? { level: this.toInteger(camp.nextLevel.level), cost: this.toInteger(camp.nextLevel.upgradeCostGrain) }
        : null;
      const etas = batches
        .map((batch) => Math.max(0, this.toInteger(batch.drainEtaMs)))
        .filter((ms) => ms > 0);
      const nextDrainMs = etas.length ? Math.min(...etas) : 0;
      return {
        cityId,
        level,
        capacity,
        parkedTotal,
        retentionHours,
        hasParked: parkedTotal > 0,
        nextDrainText: this.formatDurationShort(nextDrainMs / 1000),
        hasDrainCountdown: nextDrainMs > 0,
        canWithdraw: parkedTotal > 0,
        nextLevel,
      };
    }

    static getScoutMissionRemainingSeconds(mission, nowMs = Date.now()) {
      if (!mission) return 0;
      if (mission.status === 'ready') return 0;
      const completesAtMs = new Date(mission.completesAt).getTime();
      if (Number.isFinite(completesAtMs)) {
        return Math.max(0, Math.ceil((completesAtMs - nowMs) / 1000));
      }
      return Math.max(0, Math.ceil(Number(mission.remainingSeconds) || 0));
    }

    static formatScoutCountdown(seconds) {
      const value = Math.max(0, Math.ceil(Number(seconds) || 0));
      const minutes = Math.floor(value / 60);
      const rest = value % 60;
      return `${minutes}:${String(rest).padStart(2, '0')}`;
    }

    static buildScoutControlViewState(state = {}, options = {}) {
      const nowMs = options.nowMs ?? Date.now();
      const territoryState = state.territoryState || {};
      const directions = Array.isArray(territoryState.directions) ? territoryState.directions : [];
      const scoutMissions = Array.isArray(territoryState.scoutMissions) ? territoryState.scoutMissions : [];
      const scoutReports = Array.isArray(territoryState.scoutReports) ? territoryState.scoutReports : [];
      const activeByDirection = new Map(scoutMissions.map((mission) => [mission.direction, mission]));
      const activeScouts = scoutMissions.filter((mission) => mission.status === 'active');
      const activeScout = activeScouts[0];
      const readyCount = scoutMissions.filter((mission) => mission.status === 'ready').length;
      const maxActiveScouts = Math.max(1, this.toInteger(territoryState.maxActiveScouts || 1));

      let statusText = this.t(
        'military.scout.status.default',
        { maxActiveScouts });
      if (readyCount > 0 && activeScouts.length > 0) {
        statusText = this.t(
          'military.scout.status.readyAndActive',
          { readyCount, activeCount: activeScouts.length });
      } else if (readyCount > 0) {
        statusText = this.t(
          'military.scout.status.ready',
          { readyCount });
      } else if (activeScouts.length > 1) {
        const remaining = this.formatScoutCountdown(this.getScoutMissionRemainingSeconds(activeScout, nowMs));
        statusText = this.t(
          'military.scout.status.activeMany',
          { activeCount: activeScouts.length, remaining });
      } else if (activeScout) {
        const label = directions.find((direction) => direction.id === activeScout.direction)?.label || this.t('military.scout.direction.outside', {});
        const remaining = this.formatScoutCountdown(this.getScoutMissionRemainingSeconds(activeScout, nowMs));
        statusText = this.t(
          'military.scout.status.activeOne',
          { direction: label, remaining });
      }

      const labels = new Map(directions.map((direction) => [direction.id, direction.label]));
      const order = [
        ['nw', this.t('military.scout.direction.nw', {})], ['n', this.t('military.scout.direction.n', {})], ['ne', this.t('military.scout.direction.ne', {})],
        ['w', this.t('military.scout.direction.w', {})], ['center', this.t('military.scout.direction.center', {})], ['e', this.t('military.scout.direction.e', {})],
        ['sw', this.t('military.scout.direction.sw', {})], ['s', this.t('military.scout.direction.s', {})], ['se', this.t('military.scout.direction.se', {})],
      ];
      const cells = order.map(([id, fallbackLabel]) => {
        if (id === 'center') {
          return {
            type: 'center',
            label: this.t('military.scout.centerLabel', {}),
            subLabel: this.t('military.scout.direction.center', {}),
          };
        }
        if (!labels.has(id)) return null;
        const label = labels.get(id) || fallbackLabel;
        const mission = activeByDirection.get(id);
        if (mission?.status === 'ready') {
          return {
            type: 'button',
            id,
            direction: id,
            status: 'ready',
            disabled: false,
            action: 'claim',
            actionValue: mission.id,
            ariaLabel: this.t('military.scout.reportAria', { direction: label }),
            label,
            actionText: this.t('military.scout.report', {}),
          };
        }
        if (mission) {
          return {
            type: 'button',
            id,
            direction: id,
            status: 'active',
            disabled: true,
            action: '',
            actionValue: '',
            ariaLabel: this.t('military.scout.activeAria', { direction: label }),
            label,
            actionText: this.formatScoutCountdown(this.getScoutMissionRemainingSeconds(mission, nowMs)),
          };
        }
        if (activeScouts.length >= maxActiveScouts) {
          return {
            type: 'button',
            id,
            direction: id,
            status: 'locked',
            disabled: true,
            action: '',
            actionValue: '',
            ariaLabel: this.t('military.scout.lockedAria', { direction: label }),
            label,
            actionText: this.t('military.scout.wait', {}),
          };
        }
        return {
          type: 'button',
          id,
          direction: id,
          status: 'available',
          disabled: false,
          action: 'scout',
          actionValue: id,
          ariaLabel: this.t('military.scout.sendAria', { direction: label }),
          label,
          actionText: this.t('military.scout.send', {}),
        };
      }).filter(Boolean);

      return {
        statusText,
        cells,
        reports: scoutReports,
      };
    }
  }

  global.MilitaryPresenter = MilitaryPresenter;
  if (typeof module !== 'undefined' && module.exports) module.exports = MilitaryPresenter;
})(typeof window !== 'undefined' ? window : globalThis);
