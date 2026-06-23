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

  class BattleScenePresenter {
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

    static makeVisualGroups(soldiers, groupSize = 100) {
      const total = Math.max(0, this.toInteger(soldiers));
      const size = Math.max(1, this.toInteger(groupSize, 100));
      if (total <= 0) return [];
      return Array.from({ length: Math.ceil(total / size) }, (_, index) => {
        const remaining = total - index * size;
        return {
          index: index + 1,
          soldiers: Math.max(0, Math.min(size, remaining)),
          capacity: size,
          ratio: Math.max(0, Math.min(1, Math.max(0, Math.min(size, remaining)) / size)),
        };
      });
    }

    static getBattleTurnSoldiers(turn = {}, side = 'attacker', timing = 'before', fallback = 0) {
      const nested = turn?.[`soldiers${timing === 'after' ? 'After' : 'Before'}`]?.[side];
      if (nested !== undefined && nested !== null) return this.toInteger(nested);
      const legacyKey = `${side}Soldiers${timing === 'after' ? 'After' : 'Before'}`;
      if (turn?.[legacyKey] !== undefined && turn?.[legacyKey] !== null) return this.toInteger(turn[legacyKey]);
      return this.toInteger(fallback);
    }

    static getBattleStatusLabel(status = {}) {
      const labels = {
        shield: this.t('battle.status.shield', {}, '守御'),
        armorBreak: this.t('battle.status.armorBreak', {}, '破甲'),
        burn: this.t('battle.status.burn', {}, '灼烧'),
        poison: this.t('battle.status.poison', {}, '中毒'),
      };
      return status.label || labels[status.key] || status.key || this.t('battle.status.default', {}, '状态');
    }

    static getBattleStatusTone(status = {}) {
      if (status.key === 'shield') return 'guard';
      if (status.key === 'burn' || status.key === 'poison') return 'dot';
      if (status.key === 'armorBreak') return 'break';
      return 'status';
    }

    static formatBattleStatusBadge(status = {}) {
      const key = status.key || '';
      const label = this.getBattleStatusLabel(status);
      const turns = Math.max(0, this.toInteger(status.turnsRemaining, 0));
      const stacks = Math.max(1, this.toInteger(status.stacks, 1));
      if (key === 'shield') {
        const shield = Math.max(0, this.toInteger(status.shieldRemaining ?? status.value, 0));
        return {
          key,
          label,
          text: shield > 0 ? `${label} ${shield}` : label,
          tone: this.getBattleStatusTone(status),
          turns,
          stacks,
          shield,
        };
      }
      return {
        key,
        label,
        text: `${label}${stacks > 1 ? ` x${stacks}` : ''}${turns > 0 ? ` ${this.t('battle.status.turns', { turns }, `${turns}回合`)}` : ''}`,
        tone: this.getBattleStatusTone(status),
        turns,
        stacks,
        shield: 0,
      };
    }

    static buildBattleStatusBadges(statuses = []) {
      if (!Array.isArray(statuses)) return [];
      return statuses
        .map((status) => this.formatBattleStatusBadge(status))
        .filter((badge) => badge.text)
        .slice(0, 4);
    }

    static buildBattleSkillState(report = {}, turns = [], side = 'attacker', activeTurn = null, turnIndex = 0, showActionResult = false, ended = false) {
      const sideReport = report?.[side] || {};
      const skill = sideReport.skill && typeof sideReport.skill === 'object' ? sideReport.skill : {};
      const skillName = skill.name || (activeTurn?.actor === side ? activeTurn.skillName || activeTurn.actionDecision?.skillName : '');
      if (!skillName) return null;
      const isActiveSide = activeTurn?.actor === side;
      let remaining = 0;
      let state = 'ready';
      if (isActiveSide) {
        const before = Math.max(0, this.toInteger(activeTurn.cooldownBefore, 0));
        const after = Math.max(0, this.toInteger(activeTurn.cooldownAfter, before));
        const isSkillTurn = activeTurn.action === 'skill' || activeTurn.actionType === 'skill';
        remaining = showActionResult ? after : before;
        state = isSkillTurn && !showActionResult ? 'casting' : (remaining > 0 ? 'cooldown' : 'ready');
      } else {
        const searchEnd = ended ? turns.length - 1 : Math.max(-1, turnIndex - 1);
        const previousOwnTurn = turns.slice(0, searchEnd + 1).reverse().find((turn) => turn?.actor === side);
        remaining = Math.max(0, this.toInteger(previousOwnTurn?.cooldownAfter, 0));
        state = remaining > 0 ? 'cooldown' : 'ready';
      }
      return {
        skillName,
        cooldown: Math.max(0, this.toInteger(skill.cooldown, activeTurn?.skillCooldown || 0)),
        remaining,
        state,
        stateText: state === 'casting'
          ? this.t('battle.skill.casting', {}, '正在释放')
          : (remaining > 0
            ? this.t('battle.skill.cooldown', { remaining }, `冷却 ${remaining} 回合`)
            : this.t('battle.skill.ready', {}, '可释放')),
        active: isActiveSide,
      };
    }

    static getBattleTurnLines(turn = {}, options = {}) {
      const lines = Array.isArray(turn.lines) && turn.lines.length ? turn.lines : [turn.text].filter(Boolean);
      if (!options.active) return lines;
      const phase = options.phase || 'prepare';
      if (phase === 'cutin') {
        const skillLineIndex = lines.findIndex((line) => /发动战法|释放技能|技能|战法/.test(String(line)));
        if (skillLineIndex >= 0) return lines.slice(0, skillLineIndex + 1);
        return lines.slice(0, 1);
      }
      if (phase === 'prepare') return lines.slice(0, 1);
      if (phase === 'move') return lines.slice(0, Math.min(2, lines.length));
      return lines;
    }

    static buildBattleSceneViewState(battle = {}, options = {}) {
      const report = battle.report || battle;
      if (!report || typeof report !== 'object') return { visible: false };
      const turns = Array.isArray(report.turns) ? report.turns : [];
      const requestedTurn = this.toInteger(options.turnIndex, 0);
      const turnIndex = Math.max(0, Math.min(turns.length, requestedTurn));
      const ended = turns.length === 0 || turnIndex >= turns.length;
      const activeTurn = ended ? null : turns[turnIndex] || null;
      const previousTurn = turnIndex > 0 ? turns[turnIndex - 1] : null;
      const groupSize = this.toInteger(report.groupSize || report.visual?.groupSize, 100);
      const phase = options.phase || options.playbackPhase || 'prepare';
      const showActionResult = Boolean(activeTurn && (phase === 'impact' || phase === 'settle'));
      const attackerStart = this.toInteger(report.attacker?.soldiersStart);
      const defenderStart = this.toInteger(report.defender?.soldiersStart);
      const lastTurn = turns[turns.length - 1] || null;
      const attackerFallback = previousTurn
        ? this.getBattleTurnSoldiers(previousTurn, 'attacker', 'after', attackerStart)
        : attackerStart;
      const defenderFallback = previousTurn
        ? this.getBattleTurnSoldiers(previousTurn, 'defender', 'after', defenderStart)
        : defenderStart;
      const attackerSoldiers = ended
        ? (lastTurn ? this.getBattleTurnSoldiers(lastTurn, 'attacker', 'after', this.toInteger(report.attacker?.soldiersEnd, attackerStart)) : this.toInteger(report.attacker?.soldiersEnd, attackerStart))
        : (showActionResult
          ? this.getBattleTurnSoldiers(activeTurn, 'attacker', 'after', attackerFallback)
          : this.getBattleTurnSoldiers(activeTurn, 'attacker', 'before', attackerFallback));
      const defenderSoldiers = ended
        ? (lastTurn ? this.getBattleTurnSoldiers(lastTurn, 'defender', 'after', this.toInteger(report.defender?.soldiersEnd, defenderStart)) : this.toInteger(report.defender?.soldiersEnd, defenderStart))
        : (showActionResult
          ? this.getBattleTurnSoldiers(activeTurn, 'defender', 'after', defenderFallback)
          : this.getBattleTurnSoldiers(activeTurn, 'defender', 'before', defenderFallback));
      const resultText = report.result === 'victory'
        ? this.t('battle.result.victory', {}, '胜利')
        : report.result === 'defeat'
          ? this.t('battle.result.defeat', {}, '失败')
          : this.t('battle.result.ongoing', {}, '交战中');
      const completedLogEnd = ended ? turns.length : turnIndex;
      const previousLines = turns.slice(Math.max(0, completedLogEnd - 3), completedLogEnd).flatMap((turn) => (
        this.getBattleTurnLines(turn)
      ));
      const activeLines = activeTurn ? this.getBattleTurnLines(activeTurn, { active: true, phase }) : [];
      const fallbackLines = turns.length === 0 && report.summary ? [report.summary] : [];
      const statusesTiming = showActionResult ? 'After' : 'Before';
      const activeStatuses = activeTurn?.[`statuses${statusesTiming}`] || {};
      const previousStatuses = previousTurn?.statusesAfter || {};
      const lastStatuses = lastTurn?.statusesAfter || {};
      const attackerStatuses = ended
        ? (lastStatuses.attacker || [])
        : (activeStatuses.attacker || previousStatuses.attacker || []);
      const defenderStatuses = ended
        ? (lastStatuses.defender || [])
        : (activeStatuses.defender || previousStatuses.defender || []);
      const attackerSkill = this.buildBattleSkillState(report, turns, 'attacker', activeTurn, turnIndex, showActionResult, ended);
      const defenderSkill = this.buildBattleSkillState(report, turns, 'defender', activeTurn, turnIndex, showActionResult, ended);
      return {
        visible: true,
        id: report.id || '',
        title: this.t(
          'battle.title.vs',
          {
            attacker: this.t('battle.side.teamName', { name: report.attacker?.leaderName || this.t('battle.side.attackerFallback', {}, '己方') }, `${report.attacker?.leaderName || '己方'}队`),
            defender: this.t('battle.side.teamName', { name: report.defender?.leaderName || report.defender?.name || this.t('battle.side.defenderFallback', {}, '守军') }, `${report.defender?.leaderName || report.defender?.name || '守军'}队`),
          },
          `${report.attacker?.leaderName || '己方'}队 vs ${report.defender?.leaderName || report.defender?.name || '守军'}队`,
        ),
        resultText,
        ended,
        map: report.visual?.map || {
          id: 'frontier-field',
          name: this.t('battle.map.frontier', {}, '边境战场'),
          background: 'assets/art/battle/battlefield-forest-camp.png',
          soldierSprites: {
            attacker: 'assets/art/battle/units/player',
            defender: 'assets/art/battle/units/enemy',
          },
          palette: ['#2f3d30', '#667245', '#9a7848'],
        },
        turnIndex,
        turnCount: turns.length,
        phase,
        activeTurn,
        logLines: [...previousLines, ...activeLines, ...fallbackLines].filter(Boolean),
        attacker: {
          side: 'attacker',
          name: this.t('battle.side.teamName', { name: report.attacker?.leaderName || this.t('battle.side.attackerFallback', {}, '己方') }, `${report.attacker?.leaderName || '己方'}队`),
          leaderName: report.attacker?.leaderName || this.t('battle.leader.unnamed', {}, '无名领队'),
          leaderTitle: report.attacker?.leaderTitle || '',
          appearance: report.attacker?.appearance || {},
          sprite: report.visual?.map?.soldierSprites?.attacker || 'assets/art/battle/units/player',
          speed: this.toInteger(report.attacker?.speed),
          soldiersStart: this.toInteger(report.attacker?.soldiersStart),
          soldiers: attackerSoldiers,
          groups: this.makeVisualGroups(attackerSoldiers, groupSize),
          statuses: this.buildBattleStatusBadges(attackerStatuses),
          skillState: attackerSkill,
        },
        defender: {
          side: 'defender',
          name: this.t('battle.side.teamName', { name: report.defender?.leaderName || report.defender?.name || this.t('battle.side.defenderFallback', {}, '守军') }, `${report.defender?.leaderName || report.defender?.name || '守军'}队`),
          leaderName: report.defender?.leaderName || report.defender?.name || this.t('battle.side.defenderFallback', {}, '守军'),
          leaderTitle: report.defender?.leaderTitle || this.t('battle.side.defenderFallback', {}, '守军'),
          appearance: report.defender?.appearance || {},
          sprite: report.visual?.map?.soldierSprites?.defender || 'assets/art/battle/units/enemy',
          speed: this.toInteger(report.defender?.speed),
          soldiersStart: this.toInteger(report.defender?.soldiersStart),
          soldiers: defenderSoldiers,
          groups: this.makeVisualGroups(defenderSoldiers, groupSize),
          statuses: this.buildBattleStatusBadges(defenderStatuses),
          skillState: defenderSkill,
        },
      };
    }
  }

  global.BattleScenePresenter = BattleScenePresenter;
  if (typeof module !== 'undefined' && module.exports) module.exports = BattleScenePresenter;
})(typeof window !== 'undefined' ? window : globalThis);
