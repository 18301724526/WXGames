(function (global) {
  function battleUnitSpecFallback(host) {
    return {
      unit: 'player',
      root: 'assets/art/battle/units/player',
      frameCount: host?.constructor?.getBattleUnitFrameCount?.() || 4,
      width: 500,
      height: 400,
    };
  }

  function battleFrameSpritePathFallback(host) {
    const pathFactory = host?.constructor?.getBattleUnitFramePath;
    return typeof pathFactory === 'function'
      ? pathFactory.call(host.constructor, 'player', 'idle', 0)
      : 'assets/art/battle/units/player/idle/01.png';
  }

  const BATTLE_FACADE_METHODS = Object.freeze({
    getBattleUnitPose(...args) {
      const renderer = this.battleRenderer;
      const result = typeof renderer?.getBattleUnitPose === 'function'
        ? renderer.getBattleUnitPose(...args)
        : undefined;
      return result === undefined ? 'idle' : result;
    },

    getBattleTurnSoldierCount(...args) {
      const renderer = this.battleRenderer;
      const result = typeof renderer?.getBattleTurnSoldierCount === 'function'
        ? renderer.getBattleTurnSoldierCount(...args)
        : undefined;
      return result === undefined ? Number(args[3]) || 0 : result;
    },

    isBattleSideDefeatedByTurn(...args) {
      const renderer = this.battleRenderer;
      const result = typeof renderer?.isBattleSideDefeatedByTurn === 'function'
        ? renderer.isBattleSideDefeatedByTurn(...args)
        : undefined;
      return result === undefined ? false : result;
    },

    getBattlePlaybackPhase(...args) {
      const renderer = this.battleRenderer;
      const result = typeof renderer?.getBattlePlaybackPhase === 'function'
        ? renderer.getBattlePlaybackPhase(...args)
        : undefined;
      return result === undefined ? { phase: 'ended', phaseProgress: 1 } : result;
    },

    getBattleEngagementProgress(...args) {
      const renderer = this.battleRenderer;
      const result = typeof renderer?.getBattleEngagementProgress === 'function'
        ? renderer.getBattleEngagementProgress(...args)
        : undefined;
      return result === undefined ? 1 : result;
    },

    getBattleUnitFormationPosition(...args) {
      const renderer = this.battleRenderer;
      const result = typeof renderer?.getBattleUnitFormationPosition === 'function'
        ? renderer.getBattleUnitFormationPosition(...args)
        : undefined;
      return result === undefined ? { x: 0, y: 0, col: 0, row: 0 } : result;
    },

    getBattleUnitEngagementPosition(...args) {
      const renderer = this.battleRenderer;
      const result = typeof renderer?.getBattleUnitEngagementPosition === 'function'
        ? renderer.getBattleUnitEngagementPosition(...args)
        : undefined;
      return result === undefined ? { x: 0, y: 0, scale: 0.21 } : result;
    },

    easeBattleUnitProgress(...args) {
      const renderer = this.battleRenderer;
      const result = typeof renderer?.easeBattleUnitProgress === 'function'
        ? renderer.easeBattleUnitProgress(...args)
        : undefined;
      return result === undefined ? 0 : result;
    },

    getBattleUnitEngagementDelay(...args) {
      const renderer = this.battleRenderer;
      const result = typeof renderer?.getBattleUnitEngagementDelay === 'function'
        ? renderer.getBattleUnitEngagementDelay(...args)
        : undefined;
      return result === undefined ? 0 : result;
    },

    getBattleUnitEngagementRatio(...args) {
      const renderer = this.battleRenderer;
      const result = typeof renderer?.getBattleUnitEngagementRatio === 'function'
        ? renderer.getBattleUnitEngagementRatio(...args)
        : undefined;
      return result === undefined ? 1 : result;
    },

    getBattleUnitBattlefieldPosition(...args) {
      const renderer = this.battleRenderer;
      const result = typeof renderer?.getBattleUnitBattlefieldPosition === 'function'
        ? renderer.getBattleUnitBattlefieldPosition(...args)
        : undefined;
      return result === undefined
        ? { x: 0, y: 0, formation: {}, engaged: {}, ratio: 1 }
        : result;
    },

    getBattleUnitSpec(...args) {
      const renderer = this.battleRenderer;
      const result = typeof renderer?.getBattleUnitSpec === 'function'
        ? renderer.getBattleUnitSpec(...args)
        : undefined;
      return result === undefined ? battleUnitSpecFallback(this) : result;
    },

    getBattleFramePose(...args) {
      const renderer = this.battleRenderer;
      const result = typeof renderer?.getBattleFramePose === 'function'
        ? renderer.getBattleFramePose(...args)
        : undefined;
      return result === undefined ? 'idle' : result;
    },

    getBattleFrameIndex(...args) {
      const renderer = this.battleRenderer;
      const result = typeof renderer?.getBattleFrameIndex === 'function'
        ? renderer.getBattleFrameIndex(...args)
        : undefined;
      return result === undefined ? 0 : result;
    },

    getBattleFrameSpritePath(...args) {
      const renderer = this.battleRenderer;
      const result = typeof renderer?.getBattleFrameSpritePath === 'function'
        ? renderer.getBattleFrameSpritePath(...args)
        : undefined;
      return result === undefined ? battleFrameSpritePathFallback(this) : result;
    },

    getBattleSideSpritePath(...args) {
      const renderer = this.battleRenderer;
      const result = typeof renderer?.getBattleSideSpritePath === 'function'
        ? renderer.getBattleSideSpritePath(...args)
        : undefined;
      return result === undefined ? 'assets/art/battle/units/player' : result;
    },

    drawBattleMapBackground(...args) {
      const renderer = this.battleRenderer;
      return typeof renderer?.drawBattleMapBackground === 'function'
        ? renderer.drawBattleMapBackground(...args)
        : undefined;
    },

    drawBattleSoldierFrame(...args) {
      const renderer = this.battleRenderer;
      const result = typeof renderer?.drawBattleSoldierFrame === 'function'
        ? renderer.drawBattleSoldierFrame(...args)
        : undefined;
      return result === undefined ? false : result;
    },

    drawBattleSoldierFallback(...args) {
      const renderer = this.battleRenderer;
      return typeof renderer?.drawBattleSoldierFallback === 'function'
        ? renderer.drawBattleSoldierFallback(...args)
        : undefined;
    },

    drawBattleSoldierSprite(...args) {
      const renderer = this.battleRenderer;
      return typeof renderer?.drawBattleSoldierSprite === 'function'
        ? renderer.drawBattleSoldierSprite(...args)
        : undefined;
    },

    drawBattleSoldier(...args) {
      const renderer = this.battleRenderer;
      return typeof renderer?.drawBattleSoldier === 'function'
        ? renderer.drawBattleSoldier(...args)
        : undefined;
    },

    drawBattleArmy(...args) {
      const renderer = this.battleRenderer;
      return typeof renderer?.drawBattleArmy === 'function'
        ? renderer.drawBattleArmy(...args)
        : undefined;
    },

    getBattleStatusBadgeColors(...args) {
      const renderer = this.battleRenderer;
      return typeof renderer?.getBattleStatusBadgeColors === 'function'
        ? renderer.getBattleStatusBadgeColors(...args)
        : undefined;
    },

    drawBattleSideState(...args) {
      const renderer = this.battleRenderer;
      return typeof renderer?.drawBattleSideState === 'function'
        ? renderer.drawBattleSideState(...args)
        : undefined;
    },

    drawBattleActionEffect(...args) {
      const renderer = this.battleRenderer;
      return typeof renderer?.drawBattleActionEffect === 'function'
        ? renderer.drawBattleActionEffect(...args)
        : undefined;
    },

    drawBattleSkillCutIn(...args) {
      const renderer = this.battleRenderer;
      return typeof renderer?.drawBattleSkillCutIn === 'function'
        ? renderer.drawBattleSkillCutIn(...args)
        : undefined;
    },

    getBattleTurnDamage(...args) {
      const renderer = this.battleRenderer;
      return typeof renderer?.getBattleTurnDamage === 'function'
        ? renderer.getBattleTurnDamage(...args)
        : undefined;
    },

    getBattleDamageFloatText(...args) {
      const renderer = this.battleRenderer;
      return typeof renderer?.getBattleDamageFloatText === 'function'
        ? renderer.getBattleDamageFloatText(...args)
        : undefined;
    },

    drawBattleDamageFloat(...args) {
      const renderer = this.battleRenderer;
      return typeof renderer?.drawBattleDamageFloat === 'function'
        ? renderer.drawBattleDamageFloat(...args)
        : undefined;
    },

    drawBattleStatusFloatingTexts(...args) {
      const renderer = this.battleRenderer;
      return typeof renderer?.drawBattleStatusFloatingTexts === 'function'
        ? renderer.drawBattleStatusFloatingTexts(...args)
        : undefined;
    },

    drawBattleLeader(...args) {
      const renderer = this.battleRenderer;
      return typeof renderer?.drawBattleLeader === 'function'
        ? renderer.drawBattleLeader(...args)
        : undefined;
    },

    renderBattleSceneOverlay(...args) {
      const renderer = this.battleRenderer;
      const result = typeof renderer?.renderBattleSceneOverlay === 'function'
        ? renderer.renderBattleSceneOverlay(...args)
        : undefined;
      return result === undefined ? false : result;
    },

    renderEntityBattleOverlay(...args) {
      const renderer = this.battleRenderer;
      const result = typeof renderer?.renderEntityBattleOverlay === 'function'
        ? renderer.renderEntityBattleOverlay(...args)
        : undefined;
      return result === undefined ? false : result;
    },
  });

  function installBattleFacade(RendererClass) {
    const proto = RendererClass?.prototype;
    if (!proto) return RendererClass;
    Object.defineProperties(proto, {
      getBattleUnitPose: { configurable: true, writable: true, value: BATTLE_FACADE_METHODS.getBattleUnitPose },
      getBattleTurnSoldierCount: { configurable: true, writable: true, value: BATTLE_FACADE_METHODS.getBattleTurnSoldierCount },
      isBattleSideDefeatedByTurn: { configurable: true, writable: true, value: BATTLE_FACADE_METHODS.isBattleSideDefeatedByTurn },
      getBattlePlaybackPhase: { configurable: true, writable: true, value: BATTLE_FACADE_METHODS.getBattlePlaybackPhase },
      getBattleEngagementProgress: { configurable: true, writable: true, value: BATTLE_FACADE_METHODS.getBattleEngagementProgress },
      getBattleUnitFormationPosition: { configurable: true, writable: true, value: BATTLE_FACADE_METHODS.getBattleUnitFormationPosition },
      getBattleUnitEngagementPosition: { configurable: true, writable: true, value: BATTLE_FACADE_METHODS.getBattleUnitEngagementPosition },
      easeBattleUnitProgress: { configurable: true, writable: true, value: BATTLE_FACADE_METHODS.easeBattleUnitProgress },
      getBattleUnitEngagementDelay: { configurable: true, writable: true, value: BATTLE_FACADE_METHODS.getBattleUnitEngagementDelay },
      getBattleUnitEngagementRatio: { configurable: true, writable: true, value: BATTLE_FACADE_METHODS.getBattleUnitEngagementRatio },
      getBattleUnitBattlefieldPosition: { configurable: true, writable: true, value: BATTLE_FACADE_METHODS.getBattleUnitBattlefieldPosition },
      getBattleUnitSpec: { configurable: true, writable: true, value: BATTLE_FACADE_METHODS.getBattleUnitSpec },
      getBattleFramePose: { configurable: true, writable: true, value: BATTLE_FACADE_METHODS.getBattleFramePose },
      getBattleFrameIndex: { configurable: true, writable: true, value: BATTLE_FACADE_METHODS.getBattleFrameIndex },
      getBattleFrameSpritePath: { configurable: true, writable: true, value: BATTLE_FACADE_METHODS.getBattleFrameSpritePath },
      getBattleSideSpritePath: { configurable: true, writable: true, value: BATTLE_FACADE_METHODS.getBattleSideSpritePath },
      drawBattleMapBackground: { configurable: true, writable: true, value: BATTLE_FACADE_METHODS.drawBattleMapBackground },
      drawBattleSoldierFrame: { configurable: true, writable: true, value: BATTLE_FACADE_METHODS.drawBattleSoldierFrame },
      drawBattleSoldierFallback: { configurable: true, writable: true, value: BATTLE_FACADE_METHODS.drawBattleSoldierFallback },
      drawBattleSoldierSprite: { configurable: true, writable: true, value: BATTLE_FACADE_METHODS.drawBattleSoldierSprite },
      drawBattleSoldier: { configurable: true, writable: true, value: BATTLE_FACADE_METHODS.drawBattleSoldier },
      drawBattleArmy: { configurable: true, writable: true, value: BATTLE_FACADE_METHODS.drawBattleArmy },
      getBattleStatusBadgeColors: { configurable: true, writable: true, value: BATTLE_FACADE_METHODS.getBattleStatusBadgeColors },
      drawBattleSideState: { configurable: true, writable: true, value: BATTLE_FACADE_METHODS.drawBattleSideState },
      drawBattleActionEffect: { configurable: true, writable: true, value: BATTLE_FACADE_METHODS.drawBattleActionEffect },
      drawBattleSkillCutIn: { configurable: true, writable: true, value: BATTLE_FACADE_METHODS.drawBattleSkillCutIn },
      getBattleTurnDamage: { configurable: true, writable: true, value: BATTLE_FACADE_METHODS.getBattleTurnDamage },
      getBattleDamageFloatText: { configurable: true, writable: true, value: BATTLE_FACADE_METHODS.getBattleDamageFloatText },
      drawBattleDamageFloat: { configurable: true, writable: true, value: BATTLE_FACADE_METHODS.drawBattleDamageFloat },
      drawBattleStatusFloatingTexts: { configurable: true, writable: true, value: BATTLE_FACADE_METHODS.drawBattleStatusFloatingTexts },
      drawBattleLeader: { configurable: true, writable: true, value: BATTLE_FACADE_METHODS.drawBattleLeader },
      renderBattleSceneOverlay: { configurable: true, writable: true, value: BATTLE_FACADE_METHODS.renderBattleSceneOverlay },
      renderEntityBattleOverlay: { configurable: true, writable: true, value: BATTLE_FACADE_METHODS.renderEntityBattleOverlay },
    });
    return RendererClass;
  }

  const api = {
    BATTLE_FACADE_METHODS,
    installBattleFacade,
  };

  global.CanvasBattleFacade = api;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
