(function (global) {
  const ASSET_VERSION = 'battle-units-split-v1-20260529';
  const FRAME_COUNT = 4;
  const FRAME_POSES = Object.freeze(['idle', 'move', 'attack', 'die']);

  function clamp01(value) {
    return Math.max(0, Math.min(1, Number(value) || 0));
  }

  function getBattleUnitAssetVersion() {
    return ASSET_VERSION;
  }

  function getBattleUnitFrameCount() {
    return FRAME_COUNT;
  }

  function getBattleUnitKey(side = 'attacker') {
    return side === 'attacker' ? 'player' : 'enemy';
  }

  function getBattleUnitFramePath(unit = 'player', pose = 'idle', frameIndex = 0, rootPath = '') {
    const safeUnit = unit === 'enemy' ? 'enemy' : 'player';
    const safePose = FRAME_POSES.includes(pose) ? pose : 'idle';
    const index = Math.max(0, Math.min(FRAME_COUNT - 1, Math.floor(Number(frameIndex) || 0)));
    const file = String(index + 1).padStart(2, '0') + '.png';
    const root = rootPath && !String(rootPath).endsWith('.png')
      ? String(rootPath).replace(/\/+$/, '')
      : 'assets/art/battle/units/' + safeUnit;
    return root + '/' + safePose + '/' + file;
  }

  function getBattleUnitFramePaths() {
    const paths = [];
    ['player', 'enemy'].forEach((unit) => {
      FRAME_POSES.forEach((pose) => {
        for (let index = 0; index < FRAME_COUNT; index += 1) {
          paths.push(getBattleUnitFramePath(unit, pose, index));
        }
      });
    });
    return paths;
  }

  function getBattleTurnSoldierCount(turn = {}, side = 'attacker', timing = 'after', fallback = 0) {
    const nested = turn?.[`soldiers${timing === 'after' ? 'After' : 'Before'}`]?.[side];
    if (nested !== undefined && nested !== null) return Number(nested) || 0;
    const legacyKey = `${side}Soldiers${timing === 'after' ? 'After' : 'Before'}`;
    if (turn?.[legacyKey] !== undefined && turn?.[legacyKey] !== null) return Number(turn[legacyKey]) || 0;
    return Number(fallback) || 0;
  }

  function isBattleSideDefeatedByTurn(side = 'attacker', turn = {}) {
    const before = getBattleTurnSoldierCount(turn, side, 'before', 1);
    const after = getBattleTurnSoldierCount(turn, side, 'after', before);
    return before > 0 && after <= 0;
  }

  function getBattleUnitPose(side, activeTurn = null, phase = 'impact') {
    if (!activeTurn) return 'idle';
    if (phase === 'prepare' || phase === 'cutin' || phase === 'settle') return 'idle';
    if (activeTurn.actor === side) return phase === 'move' ? 'move' : 'attack';
    if (activeTurn.target === side) {
      if (phase === 'impact' && isBattleSideDefeatedByTurn(side, activeTurn)) return 'die';
      return phase === 'impact' ? 'hit' : 'idle';
    }
    return 'idle';
  }

  function getBattlePlaybackPhase(progress = 0, activeTurn = null) {
    if (!activeTurn) return { phase: 'ended', phaseProgress: 1 };
    const value = clamp01(progress);
    const isSkill = activeTurn.action === 'skill' || activeTurn.actionType === 'skill' || activeTurn.presentation?.cutIn;
    if (isSkill) {
      if (value < 0.70) return { phase: 'cutin', phaseProgress: value / 0.70 };
      if (value < 0.76) return { phase: 'prepare', phaseProgress: (value - 0.70) / 0.06 };
      if (value < 0.84) return { phase: 'move', phaseProgress: (value - 0.76) / 0.08 };
      if (value < 0.96) return { phase: 'impact', phaseProgress: (value - 0.84) / 0.12 };
      return { phase: 'settle', phaseProgress: (value - 0.96) / 0.04 };
    }
    if (value < 0.12) return { phase: 'prepare', phaseProgress: value / 0.12 };
    if (value < 0.46) return { phase: 'move', phaseProgress: (value - 0.12) / 0.34 };
    if (value < 0.82) return { phase: 'impact', phaseProgress: (value - 0.46) / 0.36 };
    return { phase: 'settle', phaseProgress: (value - 0.82) / 0.18 };
  }

  function getBattleEngagementProgress(turnIndex = 0, phase = 'prepare', phaseProgress = 0, activeTurn = null) {
    if (!activeTurn) return 1;
    const index = Math.max(0, Math.floor(Number(turnIndex) || 0));
    if (index > 0) return 1;
    if (phase === 'prepare') return 0;
    if (phase === 'move') return clamp01(phaseProgress);
    return 1;
  }

  function getBattleUnitFormationPosition(side = 'attacker', area = {}, index = 0, columns = 1) {
    const safeColumns = Math.max(1, Math.floor(Number(columns) || 1));
    const col = index % safeColumns;
    const row = Math.floor(index / safeColumns);
    return {
      col,
      row,
      x: side === 'attacker'
        ? area.x + col * 30 + 22
        : area.x + area.width - col * 30 - 22,
      y: area.y + row * 34 + 72 + (col % 2) * 5,
    };
  }

  function getBattleUnitEngagementPosition(side = 'attacker', area = {}, index = 0, columns = 1, scale = 0.21, canvasWidth = 0) {
    const formation = getBattleUnitFormationPosition(side, area, index, columns);
    const centerX = canvasWidth / 2;
    const laneCenter = (Math.max(1, columns) - 1) / 2;
    const laneOffset = (formation.col - laneCenter) * 7 + (((index * 13) % 5) - 2) * 2;
    const frontGap = 20 + Math.min(10, formation.row * 3);
    return {
      x: centerX + (side === 'attacker' ? -frontGap : frontGap) + laneOffset,
      y: formation.y + (((index * 7) % 5) - 2) * 2,
      scale,
    };
  }

  function easeBattleUnitProgress(progress = 0) {
    const value = clamp01(progress);
    return 1 - Math.pow(1 - value, 3);
  }

  function getBattleUnitEngagementDelay(index = 0) {
    const safeIndex = Math.max(0, Number(index) || 0);
    const row = Math.floor(safeIndex / 5);
    return Math.min(0.34, (safeIndex % 5) * 0.045 + row * 0.035);
  }

  function getBattleUnitEngagementRatio(index = 0, engagementProgress = 1) {
    const progress = clamp01(engagementProgress);
    if (progress >= 1) return 1;
    if (progress <= 0) return 0;
    const delay = getBattleUnitEngagementDelay(index);
    return easeBattleUnitProgress((progress - delay) / Math.max(0.01, 1 - delay));
  }

  function getBattleUnitBattlefieldPosition(side = 'attacker', area = {}, index = 0, columns = 1, scale = 0.21, engagementProgress = 1, canvasWidth = 0) {
    const formation = getBattleUnitFormationPosition(side, area, index, columns);
    const engaged = getBattleUnitEngagementPosition(side, area, index, columns, scale, canvasWidth);
    const ratio = getBattleUnitEngagementRatio(index, engagementProgress);
    return {
      x: formation.x + (engaged.x - formation.x) * ratio,
      y: formation.y + (engaged.y - formation.y) * ratio,
      formation,
      engaged,
      ratio,
    };
  }

  function getBattleUnitSpec(side = 'attacker', spritePath = '') {
    const unit = getBattleUnitKey(side);
    const root = spritePath && !String(spritePath).endsWith('.png') ? spritePath : `assets/art/battle/units/${unit}`;
    return {
      unit,
      root,
      frameCount: FRAME_COUNT,
      width: 500,
      height: 400,
    };
  }

  function getBattleFramePose(pose = 'idle') {
    if (pose === 'skill') return 'attack';
    if (pose === 'hit') return 'idle';
    if (pose === 'defeated') return 'die';
    if (pose === 'die') return 'die';
    return ['idle', 'move', 'attack'].includes(pose) ? pose : 'idle';
  }

  function getBattleFrameIndex(pose = 'idle', frame = 0, progress = 0) {
    if (pose === 'attack' || pose === 'skill' || pose === 'die' || pose === 'defeated') {
      return Math.max(0, Math.min(FRAME_COUNT - 1, Math.floor(clamp01(progress) * FRAME_COUNT)));
    }
    return Math.abs(Math.floor(Number(frame) || 0)) % FRAME_COUNT;
  }

  function getBattleFrameSpritePath(side = 'attacker', pose = 'idle', frame = 0, spritePath = '', progress = 0) {
    const spec = getBattleUnitSpec(side, spritePath);
    return getBattleUnitFramePath(spec.unit, getBattleFramePose(pose), getBattleFrameIndex(pose, frame, progress), spec.root);
  }

  function getBattleSideSpritePath(sideView = {}, side = 'attacker') {
    return sideView.sprite || `assets/art/battle/units/${getBattleUnitKey(side)}`;
  }

  function getBattleStatusBadgeColors(tone = 'status') {
    if (tone === 'guard') return {
      fill: 'rgba(26, 64, 72, 0.84)',
      stroke: 'rgba(132, 215, 255, 0.56)',
      color: '#bdeaff',
    };
    if (tone === 'dot') return {
      fill: 'rgba(82, 50, 26, 0.86)',
      stroke: 'rgba(255, 180, 94, 0.58)',
      color: '#ffd0a0',
    };
    if (tone === 'break') return {
      fill: 'rgba(78, 34, 34, 0.86)',
      stroke: 'rgba(255, 138, 114, 0.58)',
      color: '#ffb3a0',
    };
    return {
      fill: 'rgba(52, 43, 76, 0.84)',
      stroke: 'rgba(217, 198, 255, 0.50)',
      color: '#dfd2ff',
    };
  }

  function getBattleTurnDamage(turn = null) {
    if (!turn) return 0;
    const explicitDamage = Number(turn.damage);
    if (Number.isFinite(explicitDamage) && explicitDamage > 0) return Math.floor(explicitDamage);
    const target = turn.target === 'attacker' ? 'attacker' : 'defender';
    const before = getBattleTurnSoldierCount(turn, target, 'before', 0);
    const after = getBattleTurnSoldierCount(turn, target, 'after', before);
    return Math.max(0, before - after);
  }

  function getBattleDamageFloatText(turn = null) {
    const damage = getBattleTurnDamage(turn);
    if (damage <= 0) return '';
    if (turn?.action === 'skill' && turn?.damageLabel) return `${turn.damageLabel} -${damage}`;
    return `-${damage}`;
  }

  function getBattleScenePlayback(battleScene = {}, now = 0) {
    const turnDuration = Math.max(1, Number(battleScene?.turnDurationMs) || 720);
    const turnStartedAt = Number(battleScene?.turnStartedAt) || now;
    const turnElapsed = ((now - turnStartedAt) % turnDuration + turnDuration) % turnDuration;
    const turnProgress = turnElapsed / turnDuration;
    const reportTurns = battleScene?.report?.turns || [];
    const requestedTurnIndex = Math.max(0, Math.min(reportTurns.length, Number(battleScene?.turnIndex) || 0));
    const rawActiveTurn = requestedTurnIndex < reportTurns.length ? reportTurns[requestedTurnIndex] : null;
    return {
      frame: Math.floor((now || 0) / 140),
      requestedTurnIndex,
      rawActiveTurn,
      playback: getBattlePlaybackPhase(turnProgress, rawActiveTurn),
    };
  }

  function getBattleSceneLayout(width = 390, height = 844) {
    const fieldTop = 116;
    const logH = 122;
    const logY = height - logH - 70;
    const armyTop = fieldTop + 138;
    const armyHeight = Math.max(120, logY - armyTop - 28);
    const laneWidth = Math.min(170, width * 0.42);
    return {
      topY: 20,
      fieldTop,
      logH,
      logY,
      armyTop,
      armyHeight,
      laneWidth,
      attackerArea: { x: 18, y: armyTop, width: laneWidth, height: armyHeight },
      defenderArea: { x: width - laneWidth - 18, y: armyTop, width: laneWidth, height: armyHeight },
      buttonY: height - 54,
    };
  }

  const api = {
    getBattleUnitAssetVersion,
    getBattleUnitFrameCount,
    getBattleUnitKey,
    getBattleUnitFramePath,
    getBattleUnitFramePaths,
    getBattleTurnSoldierCount,
    isBattleSideDefeatedByTurn,
    getBattleUnitPose,
    getBattlePlaybackPhase,
    getBattleEngagementProgress,
    getBattleUnitFormationPosition,
    getBattleUnitEngagementPosition,
    easeBattleUnitProgress,
    getBattleUnitEngagementDelay,
    getBattleUnitEngagementRatio,
    getBattleUnitBattlefieldPosition,
    getBattleUnitSpec,
    getBattleFramePose,
    getBattleFrameIndex,
    getBattleFrameSpritePath,
    getBattleSideSpritePath,
    getBattleStatusBadgeColors,
    getBattleTurnDamage,
    getBattleDamageFloatText,
    getBattleScenePlayback,
    getBattleSceneLayout,
  };

  global.BattleCanvasModel = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
