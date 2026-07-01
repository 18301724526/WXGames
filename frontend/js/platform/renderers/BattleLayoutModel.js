(function (global) {
  // Battle unit layout / pose / frame / playback math, extracted from BattleCanvasRenderer.
  const BattleCanvasModel = (() => {
    if (global.BattleCanvasModel) return global.BattleCanvasModel;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('./BattleCanvasModel');
      } catch (_error) {
        return null;
      }
    }
    return null;
  })();

  function install(BattleCanvasRenderer) {
    if (!BattleCanvasRenderer?.prototype) return false;
    Object.assign(BattleCanvasRenderer.prototype, {
      getBattleUnitPose(side, activeTurn = null, phase = 'impact') {
        const result =
          typeof BattleCanvasModel?.getBattleUnitPose === 'function'
            ? BattleCanvasModel.getBattleUnitPose(side, activeTurn, phase)
            : undefined;
        return result === undefined ? 'idle' : result;
      },

      getBattleTurnSoldierCount(turn = {}, side = 'attacker', timing = 'after', fallback = 0) {
        const result =
          typeof BattleCanvasModel?.getBattleTurnSoldierCount === 'function'
            ? BattleCanvasModel.getBattleTurnSoldierCount(turn, side, timing, fallback)
            : undefined;
        return result === undefined ? Number(fallback) || 0 : result;
      },

      isBattleSideDefeatedByTurn(side = 'attacker', turn = {}) {
        const result =
          typeof BattleCanvasModel?.isBattleSideDefeatedByTurn === 'function'
            ? BattleCanvasModel.isBattleSideDefeatedByTurn(side, turn)
            : undefined;
        return result === undefined ? false : result;
      },

      getBattlePlaybackPhase(progress = 0, activeTurn = null) {
        const result =
          typeof BattleCanvasModel?.getBattlePlaybackPhase === 'function'
            ? BattleCanvasModel.getBattlePlaybackPhase(progress, activeTurn)
            : undefined;
        return result === undefined ? { phase: 'ended', phaseProgress: 1 } : result;
      },

      getBattleEngagementProgress(
        turnIndex = 0,
        phase = 'prepare',
        phaseProgress = 0,
        activeTurn = null,
      ) {
        const result =
          typeof BattleCanvasModel?.getBattleEngagementProgress === 'function'
            ? BattleCanvasModel.getBattleEngagementProgress(
                turnIndex,
                phase,
                phaseProgress,
                activeTurn,
              )
            : undefined;
        return result === undefined ? 1 : result;
      },

      getBattleUnitFormationPosition(side = 'attacker', area = {}, index = 0, columns = 1) {
        const result =
          typeof BattleCanvasModel?.getBattleUnitFormationPosition === 'function'
            ? BattleCanvasModel.getBattleUnitFormationPosition(side, area, index, columns)
            : undefined;
        return result === undefined ? { x: 0, y: 0, col: 0, row: 0 } : result;
      },

      getBattleUnitEngagementPosition(
        side = 'attacker',
        area = {},
        index = 0,
        columns = 1,
        scale = 0.21,
      ) {
        const result =
          typeof BattleCanvasModel?.getBattleUnitEngagementPosition === 'function'
            ? BattleCanvasModel.getBattleUnitEngagementPosition(
                side,
                area,
                index,
                columns,
                scale,
                this.width,
              )
            : undefined;
        return result === undefined ? { x: 0, y: 0, scale } : result;
      },

      easeBattleUnitProgress(progress = 0) {
        const result =
          typeof BattleCanvasModel?.easeBattleUnitProgress === 'function'
            ? BattleCanvasModel.easeBattleUnitProgress(progress)
            : undefined;
        return result === undefined ? 0 : result;
      },

      getBattleUnitEngagementDelay(index = 0) {
        const result =
          typeof BattleCanvasModel?.getBattleUnitEngagementDelay === 'function'
            ? BattleCanvasModel.getBattleUnitEngagementDelay(index)
            : undefined;
        return result === undefined ? 0 : result;
      },

      getBattleUnitEngagementRatio(index = 0, engagementProgress = 1) {
        const result =
          typeof BattleCanvasModel?.getBattleUnitEngagementRatio === 'function'
            ? BattleCanvasModel.getBattleUnitEngagementRatio(index, engagementProgress)
            : undefined;
        return result === undefined ? 1 : result;
      },

      getBattleUnitBattlefieldPosition(
        side = 'attacker',
        area = {},
        index = 0,
        columns = 1,
        scale = 0.21,
        engagementProgress = 1,
      ) {
        const result =
          typeof BattleCanvasModel?.getBattleUnitBattlefieldPosition === 'function'
            ? BattleCanvasModel.getBattleUnitBattlefieldPosition(
                side,
                area,
                index,
                columns,
                scale,
                engagementProgress,
                this.width,
              )
            : undefined;
        return result === undefined ? { x: 0, y: 0, formation: {}, engaged: {}, ratio: 1 } : result;
      },

      getBattleUnitSpec(side = 'attacker', spritePath = '') {
        const result =
          typeof BattleCanvasModel?.getBattleUnitSpec === 'function'
            ? BattleCanvasModel.getBattleUnitSpec(side, spritePath)
            : undefined;
        return result === undefined
          ? {
              unit: 'player',
              root: 'assets/art/battle/units/player',
              frameCount: this.constructor.getBattleUnitFrameCount(),
              width: 500,
              height: 400,
            }
          : result;
      },

      getBattleFramePose(pose = 'idle') {
        const result =
          typeof BattleCanvasModel?.getBattleFramePose === 'function'
            ? BattleCanvasModel.getBattleFramePose(pose)
            : undefined;
        return result === undefined ? 'idle' : result;
      },

      getBattleFrameIndex(pose = 'idle', frame = 0, progress = 0) {
        const result =
          typeof BattleCanvasModel?.getBattleFrameIndex === 'function'
            ? BattleCanvasModel.getBattleFrameIndex(pose, frame, progress)
            : undefined;
        return result === undefined ? 0 : result;
      },

      getBattleFrameSpritePath(
        side = 'attacker',
        pose = 'idle',
        frame = 0,
        spritePath = '',
        progress = 0,
      ) {
        const result =
          typeof BattleCanvasModel?.getBattleFrameSpritePath === 'function'
            ? BattleCanvasModel.getBattleFrameSpritePath(side, pose, frame, spritePath, progress)
            : undefined;
        return result === undefined ? 'assets/art/battle/units/player/idle/01.png' : result;
      },

      getBattleSideSpritePath(sideView = {}, side = 'attacker') {
        const result =
          typeof BattleCanvasModel?.getBattleSideSpritePath === 'function'
            ? BattleCanvasModel.getBattleSideSpritePath(sideView, side)
            : undefined;
        return result === undefined ? 'assets/art/battle/units/player' : result;
      },

      getBattleStatusBadgeColors(tone = 'status') {
        const result =
          typeof BattleCanvasModel?.getBattleStatusBadgeColors === 'function'
            ? BattleCanvasModel.getBattleStatusBadgeColors(tone)
            : undefined;
        return result === undefined
          ? {
              fill: 'rgba(52, 43, 76, 0.84)',
              stroke: 'rgba(217, 198, 255, 0.50)',
              color: '#dfd2ff',
            }
          : result;
      },

      getBattleTurnDamage(turn = null) {
        const result =
          typeof BattleCanvasModel?.getBattleTurnDamage === 'function'
            ? BattleCanvasModel.getBattleTurnDamage(turn)
            : undefined;
        return result === undefined ? 0 : result;
      },

      getBattleDamageFloatText(turn = null) {
        const result =
          typeof BattleCanvasModel?.getBattleDamageFloatText === 'function'
            ? BattleCanvasModel.getBattleDamageFloatText(turn)
            : undefined;
        return result === undefined ? '' : result;
      },

      getBattleScenePlayback(battleScene = {}, now = 0) {
        const result =
          typeof BattleCanvasModel?.getBattleScenePlayback === 'function'
            ? BattleCanvasModel.getBattleScenePlayback(battleScene, now)
            : undefined;
        return result === undefined
          ? {
              frame: Math.floor((now || 0) / 140),
              requestedTurnIndex: 0,
              rawActiveTurn: null,
              playback: { phase: 'ended', phaseProgress: 1 },
            }
          : result;
      },

      getBattleSceneLayout(width = this.width, height = this.height) {
        const result =
          typeof BattleCanvasModel?.getBattleSceneLayout === 'function'
            ? BattleCanvasModel.getBattleSceneLayout(width, height)
            : undefined;
        return result === undefined
          ? {
              topY: 20,
              fieldTop: 116,
              logH: 122,
              logY: height - 192,
              attackerArea: { x: 18, y: 254, width: Math.min(170, width * 0.42), height: 320 },
              defenderArea: {
                x: width - Math.min(170, width * 0.42) - 18,
                y: 254,
                width: Math.min(170, width * 0.42),
                height: 320,
              },
              buttonY: height - 54,
            }
          : result;
      },
    });
    return true;
  }

  const BattleLayoutModel = { install };
  global.BattleLayoutModel = BattleLayoutModel;
  if (typeof module !== 'undefined' && module.exports) module.exports = BattleLayoutModel;
})(typeof window !== 'undefined' ? window : globalThis);
