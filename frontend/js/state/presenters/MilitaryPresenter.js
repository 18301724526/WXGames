(function (global) {
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
      const requestedView = ['army', 'scout', 'world'].includes(state.militaryView) ? state.militaryView : 'army';
      const activeView = requestedView;
      const views = ['army', 'scout', 'world'].map((id) => ({
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
      const cityFormations = Array.isArray(rawFormations[cityId]) ? rawFormations[cityId] : [];
      const maxFormationMembers = 5;
      const formationNames = ['部队一', '部队二', '部队三'];
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
          name: rawFormation.name || formationNames[slot - 1] || `部队${slot}`,
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

      let trainingText = `下一批 ${batchSize} 兵 · ${progress}/${interval} 秒`;
      let trainingProgressWidth = interval > 0
        ? `${Math.max(0, Math.min(100, Math.floor((progress / interval) * 100)))}%`
        : '0%';

      if (soldiers >= cap && cap > 0) {
        trainingText = '训练已满';
        trainingProgressWidth = '100%';
      } else if (cap <= 0 || interval <= 0) {
        trainingText = '等待兵营';
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
          summary: `3 支部队 · 每队最多 ${maxFormationMembers} 名名人`,
        },
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

      let statusText = `选择方向派出侦察队；同一时间最多可有 ${maxActiveScouts} 支侦察队在外。`;
      if (readyCount > 0 && activeScouts.length > 0) {
        statusText = `${readyCount} 份报告待查看，另有 ${activeScouts.length} 支侦察队仍在外。`;
      } else if (readyCount > 0) {
        statusText = `${readyCount} 份侦察报告待查看，你仍可继续派出侦察队。`;
      } else if (activeScouts.length > 1) {
        statusText = `${activeScouts.length} 支侦察队在外行动，最早一支约 ${this.formatScoutCountdown(this.getScoutMissionRemainingSeconds(activeScout, nowMs))} 后返回。`;
      } else if (activeScout) {
        const label = directions.find((direction) => direction.id === activeScout.direction)?.label || '外部';
        statusText = `${label}侦察中，预计 ${this.formatScoutCountdown(this.getScoutMissionRemainingSeconds(activeScout, nowMs))} 后返回。`;
      }

      const labels = new Map(directions.map((direction) => [direction.id, direction.label]));
      const order = [
        ['nw', '西北'], ['n', '北'], ['ne', '东北'],
        ['w', '西'], ['center', '本城'], ['e', '东'],
        ['sw', '西南'], ['s', '南'], ['se', '东南'],
      ];
      const cells = order.map(([id, fallbackLabel]) => {
        if (id === 'center') {
          return {
            type: 'center',
            label: '城',
            subLabel: '本城',
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
            ariaLabel: `${label}侦察报告`,
            label,
            actionText: '报告',
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
            ariaLabel: `${label}侦察中`,
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
            ariaLabel: `${label}侦察暂不可用`,
            label,
            actionText: '等待',
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
          ariaLabel: `向${label}派出侦察`,
          label,
          actionText: '派出',
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
