(function (global) {
  const BATTLE_FACADE_METHODS = Object.freeze([
    ['getBattleUnitPose', () => 'idle'],
    ['getBattleTurnSoldierCount', (host, args) => Number(args[3]) || 0],
    ['isBattleSideDefeatedByTurn', () => false],
    ['getBattlePlaybackPhase', () => ({ phase: 'ended', phaseProgress: 1 })],
    ['getBattleEngagementProgress', () => 1],
    ['getBattleUnitFormationPosition', () => ({ x: 0, y: 0, col: 0, row: 0 })],
    ['getBattleUnitEngagementPosition', () => ({ x: 0, y: 0, scale: 0.21 })],
    ['easeBattleUnitProgress', () => 0],
    ['getBattleUnitEngagementDelay', () => 0],
    ['getBattleUnitEngagementRatio', () => 1],
    ['getBattleUnitBattlefieldPosition', () => ({ x: 0, y: 0, formation: {}, engaged: {}, ratio: 1 })],
    ['getBattleUnitSpec', (host) => ({
      unit: 'player',
      root: 'assets/art/battle/units/player',
      frameCount: host?.constructor?.getBattleUnitFrameCount?.() || 4,
      width: 500,
      height: 400,
    })],
    ['getBattleFramePose', () => 'idle'],
    ['getBattleFrameIndex', () => 0],
    ['getBattleFrameSpritePath', (host) => {
      const pathFactory = host?.constructor?.getBattleUnitFramePath;
      return typeof pathFactory === 'function'
        ? pathFactory.call(host.constructor, 'player', 'idle', 0)
        : 'assets/art/battle/units/player/idle/01.png';
    }],
    ['getBattleSideSpritePath', () => 'assets/art/battle/units/player'],
    ['drawBattleMapBackground', undefined],
    ['drawBattleSoldierFrame', false],
    ['drawBattleSoldierFallback', undefined],
    ['drawBattleSoldierSprite', undefined],
    ['drawBattleSoldier', undefined],
    ['drawBattleArmy', undefined],
    ['getBattleStatusBadgeColors', undefined],
    ['drawBattleSideState', undefined],
    ['drawBattleActionEffect', undefined],
    ['drawBattleSkillCutIn', undefined],
    ['getBattleTurnDamage', undefined],
    ['getBattleDamageFloatText', undefined],
    ['drawBattleDamageFloat', undefined],
    ['drawBattleStatusFloatingTexts', undefined],
    ['drawBattleLeader', undefined],
    ['renderBattleSceneOverlay', false],
  ]);

  function cloneFallback(fallback) {
    if (Array.isArray(fallback)) return fallback.slice();
    if (fallback && typeof fallback === 'object') return { ...fallback };
    return fallback;
  }

  function resolveFallback(host, args, fallback) {
    const value = typeof fallback === 'function' ? fallback(host, args) : fallback;
    return cloneFallback(value);
  }

  function defineFacadeMethod(proto, method, fallback) {
    Object.defineProperty(proto, method, {
      configurable: true,
      writable: true,
      value: function (...args) {
        const result = this.delegateBattleRenderer(method, args);
        return result === undefined ? resolveFallback(this, args, fallback) : result;
      },
    });
  }

  function installBattleFacade(RendererClass) {
    const proto = RendererClass?.prototype;
    if (!proto) return RendererClass;
    Object.defineProperty(proto, 'delegateBattleRenderer', {
      configurable: true,
      writable: true,
      value(method, args = []) {
        const renderer = this.battleRenderer;
        if (!renderer || typeof renderer[method] !== 'function') return undefined;
        return renderer[method](...Array.from(args));
      },
    });
    BATTLE_FACADE_METHODS.forEach(([method, fallback]) => {
      defineFacadeMethod(proto, method, fallback);
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
