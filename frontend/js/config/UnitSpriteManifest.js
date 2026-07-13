(function (global) {
  // The default unit that marches when a mission does not name a unitKey. Single source
  // for the value that used to be duplicated as a literal across the actor snapshot and
  // the world actor renderer.
  const DEFAULT_MARCH_UNIT_KEY = 'scout_squad_default';

  // 2D fallback frame animation shared by every barbarian-age march unit. Reused as the
  // graceful fallback whenever the spine runtime/asset is unavailable.
  const BARBARIAN_MARCH_2D = Object.freeze({
    move: Object.freeze({
      id: 'move',
      frameCount: 11,
      frameDurationMs: 80,
      basePath: 'assets/art/units/spearman/move',
      framePrefix: '',
      frameExtension: 'png',
      framePad: 3,
    }),
  });

  // Spine march skeletons, keyed by descriptor id. Path convention:
  //   assets/art/spine/march/<era>/<unit>/<era>_<unit>.{json,atlas,png}
  // The exported skeleton carries four directional walk animations named '1'..'4' that map
  // to the four grid facings produced by worldMarchCore.axisStepDir:
  //   1 = 右上(-r)  2 = 左上(-q)  3 = 右下(+q)  4 = 左下(+r)
  const SPINE_MARCH = Object.freeze({
    barbarian_infantry: Object.freeze({
      id: 'barbarian_infantry',
      era: 'barbarian',
      unit: 'infantry',
      assetBase: 'assets/art/spine/march/barbarian/infantry/',
      jsonFile: 'barbarian_infantry.json',
      atlasFile: 'barbarian_infantry.atlas',
      // Grid facing (worldMarchCore.axisStepDir) -> exported spine animation name. The export
      // swapped the two downward walks: animation '4' walks 右下 and '3' walks 左下, so facing
      // '3' (+q 右下) plays '4' and facing '4' (+r 左下) plays '3'.
      directions: Object.freeze({ 1: '1', 2: '2', 3: '4', 4: '3' }),
      defaultDirection: '3',
      loop: true,
    }),
  });

  const UNIT_SPRITES = Object.freeze({
    scout_squad_default: Object.freeze({
      id: 'scout_squad_default',
      label: 'Scout Squad',
      spine: 'barbarian_infantry',
      animations: BARBARIAN_MARCH_2D,
    }),
    hostile_squad_default: Object.freeze({
      id: 'hostile_squad_default',
      label: 'Hostile Squad',
      spine: 'barbarian_infantry',
      animations: BARBARIAN_MARCH_2D,
    }),
    barbarian_infantry: Object.freeze({
      id: 'barbarian_infantry',
      label: 'Barbarian Infantry',
      era: 'barbarian',
      spine: 'barbarian_infantry',
      animations: BARBARIAN_MARCH_2D,
    }),
    spearman: Object.freeze({
      id: 'spearman',
      label: 'Spearman',
      spine: 'barbarian_infantry',
      animations: BARBARIAN_MARCH_2D,
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

  // Resolve the spine skeleton descriptor for a unit, or null when the unit has no spine
  // skeleton (callers fall back to the 2D frame animation).
  function getSpineDescriptor(unitId = DEFAULT_MARCH_UNIT_KEY) {
    const key = getUnitDefinition(unitId)?.spine;
    return key ? SPINE_MARCH[key] || null : null;
  }

  function hasSpine(unitId = DEFAULT_MARCH_UNIT_KEY) {
    return Boolean(getSpineDescriptor(unitId));
  }

  // Map a grid facing ('1'..'4' from worldMarchCore.axisStepDir) to the spine animation
  // name for a unit. Empty/unknown facings resolve to the descriptor's default direction.
  function getDirectionAnimation(unitId = DEFAULT_MARCH_UNIT_KEY, direction = '') {
    const descriptor = getSpineDescriptor(unitId);
    if (!descriptor) return '';
    const directions = descriptor.directions || {};
    const key = String(direction || '');
    return directions[key] || directions[descriptor.defaultDirection] || '';
  }

  const UnitSpriteManifest = {
    UNIT_SPRITES,
    SPINE_MARCH,
    DEFAULT_MARCH_UNIT_KEY,
    getUnitDefinition,
    getAnimationDefinition,
    getFramePath,
    getFramePaths,
    getFrameDurationMs,
    getSpineDescriptor,
    hasSpine,
    getDirectionAnimation,
  };

  global.UnitSpriteManifest = UnitSpriteManifest;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = UnitSpriteManifest;
  }
})(typeof window !== 'undefined' ? window : globalThis);
