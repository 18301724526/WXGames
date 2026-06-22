(function (global) {
  const UNIT_SPRITES = Object.freeze({
    tutorial_intro_soldier: Object.freeze({
      id: 'tutorial_intro_soldier',
      label: 'Tutorial Intro Soldier',
      animations: Object.freeze({
        move: Object.freeze({
          id: 'move',
          frameCount: 11,
          frameDurationMs: 80,
          basePath: 'assets/art/units/spearman/move',
          framePrefix: '',
          frameExtension: 'png',
          framePad: 3,
        }),
      }),
    }),
    scout_squad_default: Object.freeze({
      id: 'scout_squad_default',
      label: 'Scout Squad',
      animations: Object.freeze({
        move: Object.freeze({
          id: 'move',
          frameCount: 11,
          frameDurationMs: 80,
          basePath: 'assets/art/units/spearman/move',
          framePrefix: '',
          frameExtension: 'png',
          framePad: 3,
        }),
      }),
    }),
    hostile_squad_default: Object.freeze({
      id: 'hostile_squad_default',
      label: 'Hostile Squad',
      animations: Object.freeze({
        move: Object.freeze({
          id: 'move',
          frameCount: 11,
          frameDurationMs: 80,
          basePath: 'assets/art/units/spearman/move',
          framePrefix: '',
          frameExtension: 'png',
          framePad: 3,
        }),
      }),
    }),
    spearman: Object.freeze({
      id: 'spearman',
      label: 'Spearman',
      animations: Object.freeze({
        move: Object.freeze({
          id: 'move',
          frameCount: 11,
          frameDurationMs: 80,
          basePath: 'assets/art/units/spearman/move',
          framePrefix: '',
          frameExtension: 'png',
          framePad: 3,
        }),
      }),
    }),
  });

  function getUnitDefinition(unitId = 'spearman') {
    return UNIT_SPRITES[unitId] || null;
  }

  function getAnimationDefinition(unitId = 'spearman', animationId = 'move') {
    return getUnitDefinition(unitId)?.animations?.[animationId] || null;
  }

  function getFramePath(unitId = 'spearman', animationId = 'move', frameIndex = 0) {
    const animation = getAnimationDefinition(unitId, animationId);
    if (!animation) return '';
    const index = Math.max(0, Math.floor(Number(frameIndex) || 0));
    const frameNumber = String(index + 1).padStart(animation.framePad || 3, '0');
    return `${animation.basePath}/${animation.framePrefix || ''}${frameNumber}.${animation.frameExtension || 'png'}`;
  }

  function getFramePaths(unitId = 'spearman', animationId = 'move') {
    const animation = getAnimationDefinition(unitId, animationId);
    if (!animation) return [];
    return Array.from({ length: animation.frameCount }, (_, index) => getFramePath(unitId, animationId, index));
  }

  function getFrameDurationMs(unitId = 'spearman', animationId = 'move') {
    return Math.max(1, Number(getAnimationDefinition(unitId, animationId)?.frameDurationMs) || 80);
  }

  const UnitSpriteManifest = {
    UNIT_SPRITES,
    getUnitDefinition,
    getAnimationDefinition,
    getFramePath,
    getFramePaths,
    getFrameDurationMs,
  };

  global.UnitSpriteManifest = UnitSpriteManifest;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = UnitSpriteManifest;
  }
})(typeof window !== 'undefined' ? window : globalThis);
