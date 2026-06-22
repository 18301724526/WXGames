(function (global) {
  const BattleCanvasModel = (() => {
    if (global.BattleCanvasModel) return global.BattleCanvasModel;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('./BattleCanvasModel');
      } catch (error) {
        return null;
      }
    }
    return null;
  })();

  const BattleFloatingTextRenderer = (() => {
    if (global.BattleFloatingTextRenderer) return global.BattleFloatingTextRenderer;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('./BattleFloatingTextRenderer');
      } catch (error) {
        return null;
      }
    }
    return null;
  })();

  const BattleEffectRenderer = (() => {
    if (global.BattleEffectRenderer) return global.BattleEffectRenderer;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('./BattleEffectRenderer');
      } catch (error) {
        return null;
      }
    }
    return null;
  })();

  const BattleCameraPolicy = (() => {
    if (global.BattleCameraPolicy) return global.BattleCameraPolicy;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../../domain/BattleCameraPolicy');
      } catch (_error) {
        return null;
      }
    }
    return null;
  })();

  function model(method, args = [], fallback = undefined) {
    const fn = BattleCanvasModel?.[method];
    if (typeof fn === 'function') return fn(...args);
    return typeof fallback === 'function' ? fallback() : fallback;
  }

  // ---- entity battle (live sim) constants ----
  // The entity battle is the 三国群英传-style mass-melee scene driven by
  // battleSimCore. It is rendered through this canvas renderer (no DOM) for both
  // the interactive 军令 path and the passive replay path. State lives on
  // options.entityBattle; the app owns the sim stepping, this owns the drawing.
  const ENTITY_STATE_POSE = { engage: 'attack', hold: 'idle', covering: 'move', advance: 'move', retreat: 'move', dead: 'die' };
  const ENTITY_FRAMES = 4;
  const ENTITY_FRAME_MS = 130;
  const ENTITY_SPRITE_SCALE = 2;
  const ENTITY_ORDER_LABELS = [
    ['advance', '前进'],
    ['soldierAttack', '士兵出击'],
    ['generalCharge', '武将出击'],
    ['generalRetreat', '武将后退'],
    ['defend', '防御'],
    ['cover', '掩护'],
  ];
  const ENTITY_MASTER_LABELS = [['allOut', '全军出击'], ['allRetreat', '全军撤退']];

  class BattleCanvasRenderer {
    constructor(options = {}) {
      this.host = options.host || null;
      this.drawingSurface = options.drawingSurface || null;
    }

    get width() {
      return this.host?.width;
    }

    get height() {
      return this.host?.height;
    }

    get ctx() {
      return this.host?.ctx;
    }

    get presenter() {
      return this.host?.presenter;
    }

    callDrawingSurface(method, args = []) {
      const explicitSurface = this.drawingSurface;
      if (explicitSurface && typeof explicitSurface[method] === 'function') {
        return explicitSurface[method](...Array.from(args));
      }
      const fallbackSurface = this.host;
      if (fallbackSurface && typeof fallbackSurface[method] === 'function') {
        return fallbackSurface[method](...Array.from(args));
      }
      return undefined;
    }

    addHitTarget(...args) {
      return this.callDrawingSurface('addHitTarget', args);
    }

    drawButton(...args) {
      return this.callDrawingSurface('drawButton', args);
    }

    drawCircle(...args) {
      return this.callDrawingSurface('drawCircle', args);
    }

    drawCoverAsset(...args) {
      return this.callDrawingSurface('drawCoverAsset', args);
    }

    drawFamousPortrait(...args) {
      return this.callDrawingSurface('drawFamousPortrait', args);
    }

    drawPanel(...args) {
      return this.callDrawingSurface('drawPanel', args);
    }

    drawText(...args) {
      return this.callDrawingSurface('drawText', args);
    }

    getAsset(...args) {
      return this.callDrawingSurface('getAsset', args);
    }

    getNow(...args) {
      return this.callDrawingSurface('getNow', args);
    }

    measureTextWidth(...args) {
      return this.callDrawingSurface('measureTextWidth', args);
    }

    setHitTargets(...args) {
      return this.callDrawingSurface('setHitTargets', args);
    }

    truncateText(...args) {
      return this.callDrawingSurface('truncateText', args);
    }

    static getBattleUnitAssetVersion() {
      return model('getBattleUnitAssetVersion', [], 'battle-units-split-v1-20260529');
    }

    static getBattleUnitFrameCount() {
      return model('getBattleUnitFrameCount', [], 4);
    }

    static getBattleUnitKey(side = 'attacker') {
      return model('getBattleUnitKey', [side], side === 'attacker' ? 'player' : 'enemy');
    }

    static getBattleUnitFramePath(unit = 'player', pose = 'idle', frameIndex = 0, rootPath = '') {
      return model(
        'getBattleUnitFramePath',
        [unit, pose, frameIndex, rootPath],
        'assets/art/battle/units/player/idle/01.png',
      );
    }

    static getBattleUnitFramePaths() {
      return model('getBattleUnitFramePaths', [], []);
    }

    render(state = {}, options = {}) {
      return this.renderBattleSceneOverlay(state, options);
    }

    getBattleUnitPose(side, activeTurn = null, phase = 'impact') {
      return model('getBattleUnitPose', [side, activeTurn, phase], 'idle');
    }

    getBattleTurnSoldierCount(turn = {}, side = 'attacker', timing = 'after', fallback = 0) {
      return model('getBattleTurnSoldierCount', [turn, side, timing, fallback], Number(fallback) || 0);
    }

    isBattleSideDefeatedByTurn(side = 'attacker', turn = {}) {
      return model('isBattleSideDefeatedByTurn', [side, turn], false);
    }

    getBattlePlaybackPhase(progress = 0, activeTurn = null) {
      return model('getBattlePlaybackPhase', [progress, activeTurn], { phase: 'ended', phaseProgress: 1 });
    }

    getBattleEngagementProgress(turnIndex = 0, phase = 'prepare', phaseProgress = 0, activeTurn = null) {
      return model('getBattleEngagementProgress', [turnIndex, phase, phaseProgress, activeTurn], 1);
    }

    getBattleUnitFormationPosition(side = 'attacker', area = {}, index = 0, columns = 1) {
      return model('getBattleUnitFormationPosition', [side, area, index, columns], { x: 0, y: 0, col: 0, row: 0 });
    }

    getBattleUnitEngagementPosition(side = 'attacker', area = {}, index = 0, columns = 1, scale = 0.21) {
      return model('getBattleUnitEngagementPosition', [side, area, index, columns, scale, this.width], { x: 0, y: 0, scale });
    }

    easeBattleUnitProgress(progress = 0) {
      return model('easeBattleUnitProgress', [progress], 0);
    }

    getBattleUnitEngagementDelay(index = 0) {
      return model('getBattleUnitEngagementDelay', [index], 0);
    }

    getBattleUnitEngagementRatio(index = 0, engagementProgress = 1) {
      return model('getBattleUnitEngagementRatio', [index, engagementProgress], 1);
    }

    getBattleUnitBattlefieldPosition(side = 'attacker', area = {}, index = 0, columns = 1, scale = 0.21, engagementProgress = 1) {
      return model(
        'getBattleUnitBattlefieldPosition',
        [side, area, index, columns, scale, engagementProgress, this.width],
        { x: 0, y: 0, formation: {}, engaged: {}, ratio: 1 },
      );
    }

    getBattleUnitSpec(side = 'attacker', spritePath = '') {
      return model('getBattleUnitSpec', [side, spritePath], {
        unit: 'player',
        root: 'assets/art/battle/units/player',
        frameCount: this.constructor.getBattleUnitFrameCount(),
        width: 500,
        height: 400,
      });
    }

    getBattleFramePose(pose = 'idle') {
      return model('getBattleFramePose', [pose], 'idle');
    }

    getBattleFrameIndex(pose = 'idle', frame = 0, progress = 0) {
      return model('getBattleFrameIndex', [pose, frame, progress], 0);
    }

    getBattleFrameSpritePath(side = 'attacker', pose = 'idle', frame = 0, spritePath = '', progress = 0) {
      return model(
        'getBattleFrameSpritePath',
        [side, pose, frame, spritePath, progress],
        'assets/art/battle/units/player/idle/01.png',
      );
    }

    getBattleSideSpritePath(sideView = {}, side = 'attacker') {
      return model('getBattleSideSpritePath', [sideView, side], 'assets/art/battle/units/player');
    }

    getBattleStatusBadgeColors(tone = 'status') {
      return model('getBattleStatusBadgeColors', [tone], {
        fill: 'rgba(52, 43, 76, 0.84)',
        stroke: 'rgba(217, 198, 255, 0.50)',
        color: '#dfd2ff',
      });
    }

    getBattleTurnDamage(turn = null) {
      return model('getBattleTurnDamage', [turn], 0);
    }

    getBattleDamageFloatText(turn = null) {
      return model('getBattleDamageFloatText', [turn], '');
    }

    getBattleScenePlayback(battleScene = {}, now = 0) {
      return model('getBattleScenePlayback', [battleScene, now], {
        frame: Math.floor((now || 0) / 140),
        requestedTurnIndex: 0,
        rawActiveTurn: null,
        playback: { phase: 'ended', phaseProgress: 1 },
      });
    }

    getBattleSceneLayout(width = this.width, height = this.height) {
      return model('getBattleSceneLayout', [width, height], {
        topY: 20,
        fieldTop: 116,
        logH: 122,
        logY: height - 192,
        attackerArea: { x: 18, y: 254, width: Math.min(170, width * 0.42), height: 320 },
        defenderArea: { x: width - Math.min(170, width * 0.42) - 18, y: 254, width: Math.min(170, width * 0.42), height: 320 },
        buttonY: height - 54,
      });
    }

    drawBattleMapBackground(map = {}) {
      const path = map.background || 'assets/art/battle/battlefield-forest-camp.png';
      if (this.drawCoverAsset(path, 0, 0, this.width, this.height)) return;
      if (!this.ctx) return;
      this.ctx.fillStyle = '#1d2119';
      this.ctx.fillRect(0, 0, this.width, this.height);
    }

    drawBattleSoldierFrame(x, y, side = 'attacker', pose = 'idle', frame = 0, ratio = 1, scale = 0.22, spritePath = '', progress = 0) {
      const spec = this.getBattleUnitSpec(side, spritePath);
      const image = this.getAsset(this.getBattleFrameSpritePath(side, pose, frame, spritePath, progress));
      if (!image || typeof this.ctx?.drawImage !== 'function') return false;
      const previousAlpha = typeof this.ctx.globalAlpha === 'number' ? this.ctx.globalAlpha : 1;
      this.ctx.globalAlpha = previousAlpha * Math.max(0.25, Math.min(1, Number(ratio) || 1));
      const sourceWidth = Number(image.naturalWidth || image.width || spec.width);
      const sourceHeight = Number(image.naturalHeight || image.height || spec.height);
      const dw = sourceWidth * scale;
      const dh = sourceHeight * scale;
      const drawX = x - dw / 2;
      const drawY = y - dh;
      this.ctx.drawImage(image, drawX, drawY, dw, dh);
      this.drawBattleHitFlash(image, { drawX, drawY, dw, dh, pose, progress, previousAlpha });
      this.ctx.globalAlpha = previousAlpha;
      return true;
    }

    drawBattleHitFlash(image, options = {}) {
      if (options.pose !== 'hit' || typeof this.ctx?.filter !== 'string') return;
      const flashAlpha = Math.sin(Math.max(0, Math.min(1, Number(options.progress) || 0)) * Math.PI) * 0.36;
      if (flashAlpha <= 0.01) return;
      const alpha = typeof this.ctx.globalAlpha === 'number' ? this.ctx.globalAlpha : options.previousAlpha;
      const previousFilter = this.ctx.filter;
      this.ctx.globalAlpha = alpha * flashAlpha;
      this.ctx.filter = 'brightness(2.4) saturate(0)';
      this.ctx.drawImage(image, options.drawX, options.drawY, options.dw, options.dh);
      this.ctx.filter = previousFilter;
    }

    drawBattleSoldierFallback(x, y, side = 'attacker', ratio = 1) {
      if (!this.ctx) return;
      const previousAlpha = typeof this.ctx.globalAlpha === 'number' ? this.ctx.globalAlpha : 1;
      this.ctx.globalAlpha = previousAlpha * Math.max(0.25, Math.min(1, Number(ratio) || 1));
      const color = side === 'attacker' ? '#74d3a0' : '#e07b62';
      this.drawCircle(x, y - 18, 5, { fill: color });
      this.drawPanel(x - 6, y - 14, 12, 16, { fill: color, radius: 2 });
      this.ctx.globalAlpha = previousAlpha;
    }

    drawBattleSoldierSprite(x, y, side = 'attacker', pose = 'idle', frame = 0, ratio = 1, scale = 0.22, spritePath = '', progress = 0) {
      if (this.drawBattleSoldierFrame(x, y, side, pose, frame, ratio, scale, spritePath, progress)) return;
      this.drawBattleSoldierFallback(x, y, side, ratio);
    }

    drawBattleSoldier(x, y, side = 'attacker', pose = 'idle', frame = 0, ratio = 1, scale = 0.22) {
      return this.drawBattleSoldierSprite(x, y, side, pose, frame, ratio, scale);
    }

    drawBattleArmy(sideView = {}, area = {}, options = {}) {
      const groups = sideView.groups || [];
      const pose = options.pose || 'idle';
      const visualGroups = groups.length || !(pose === 'die' || pose === 'defeated') ? groups : [{ ratio: 1, soldiers: 0, capacity: 1 }];
      const side = sideView.side || 'attacker';
      const frame = Number(options.frame) || 0;
      const progress = Math.max(0, Math.min(1, Number(options.progress) || 0));
      const engagementProgress = Math.max(0, Math.min(1, Number(options.engagementProgress ?? 1) || 0));
      const actionType = options.actionType || '';
      const columns = Math.max(1, Math.floor(area.width / 34));
      const activeCount = pose === 'idle' ? 0 : Math.min(visualGroups.length, actionType === 'skill' ? 5 : 3);
      const hitOffset = pose === 'hit' ? Math.sin(frame * 2.2) * 5 * (side === 'attacker' ? 1 : -1) : 0;
      visualGroups.slice(0, 18).forEach((group, index) => {
        const active = index < activeCount;
        const position = this.getBattleUnitBattlefieldPosition(side, area, index, columns, active ? 0.245 : 0.21, engagementProgress);
        this.drawBattleSoldierSprite(
          position.x + (active ? hitOffset * Math.max(0, 1 - index * 0.12) : 0),
          position.y,
          side,
          active ? pose : 'idle',
          frame + index,
          group.ratio,
          active ? 0.245 : 0.21,
          this.getBattleSideSpritePath(sideView, side),
          progress,
        );
      });
      this.drawBattleArmyCount(sideView, area, side, groups.length);
    }

    drawBattleArmyCount(sideView = {}, area = {}, side = 'attacker', groupCount = 0) {
      if (groupCount > 18) {
        this.drawText(`+${groupCount - 18}`, side === 'attacker' ? area.x + area.width - 28 : area.x + 10, area.y + area.height - 22, {
          size: 12,
          bold: true,
          color: '#f6e8c8',
        });
      }
      this.drawText(`${sideView.soldiers || 0}/${sideView.soldiersStart || 0}`, area.x + area.width / 2, area.y + area.height + 6, {
        size: 12,
        bold: true,
        color: side === 'attacker' ? '#74d3a0' : '#e07b62',
        align: 'center',
      });
    }

    drawBattleSideState(sideView = {}, area = {}, side = 'attacker') {
      const panelWidth = Math.min(154, Math.max(128, area.width + 8));
      const x = side === 'attacker' ? area.x : area.x + area.width - panelWidth;
      const y = Math.max(92, area.y - 74);
      this.drawPanel(x, y, panelWidth, 72, {
        fill: 'rgba(18, 14, 10, 0.64)',
        stroke: side === 'attacker' ? 'rgba(116, 211, 160, 0.28)' : 'rgba(224, 123, 98, 0.28)',
        radius: 8,
        inset: 'rgba(255, 231, 184, 0.06)',
      });
      const skillState = sideView.skillState || null;
      const skillName = skillState?.skillName ? this.truncateText(skillState.skillName, panelWidth - 82, { size: 11, bold: true }) : '\u65e0\u6218\u6cd5';
      const stateText = skillState?.stateText || '\u53ea\u666e\u653b';
      this.drawText(skillName, x + 10, y + 11, { size: 11, bold: true, color: skillState?.active ? '#ffe6b5' : '#cbbd96' });
      this.drawText(this.truncateText(stateText, 68, { size: 10, bold: true }), x + panelWidth - 10, y + 11, {
        size: 10,
        bold: true,
        color: skillState?.state === 'ready' ? '#74d3a0' : (skillState?.state === 'casting' ? '#ffd66e' : '#aeb0b8'),
        align: 'right',
      });
      this.drawBattleStatusBadges(sideView.statuses, x, y, panelWidth);
    }

    drawBattleStatusBadges(statuses = [], x = 0, y = 0, panelWidth = 140) {
      const list = Array.isArray(statuses) ? statuses : [];
      if (!list.length) {
        this.drawText('\u72b6\u6001\uff1a\u65e0', x + 10, y + 42, { size: 11, color: '#8d8f99' });
        return;
      }
      let cursorX = x + 10;
      let cursorY = y + 40;
      list.slice(0, 4).forEach((status) => {
        const label = this.truncateText(status.text || status.label || '\u72b6\u6001', 68, { size: 10, bold: true });
        const width = Math.min(74, Math.max(38, this.measureTextWidth(label, { size: 10, bold: true }) + 14));
        if (cursorX + width > x + panelWidth - 8) {
          cursorX = x + 10;
          cursorY += 20;
        }
        if (cursorY > y + 55) return;
        const colors = this.getBattleStatusBadgeColors(status.tone);
        this.drawPanel(cursorX, cursorY, width, 16, {
          fill: colors.fill,
          stroke: colors.stroke,
          radius: 5,
          inset: 'rgba(255, 255, 255, 0.04)',
        });
        this.drawText(label, cursorX + width / 2, cursorY + 8, {
          size: 10,
          bold: true,
          color: colors.color,
          align: 'center',
          baseline: 'middle',
        });
        cursorX += width + 5;
      });
    }

    drawBattleActionEffect(activeTurn = null, progress = 0) {
      return BattleEffectRenderer?.drawBattleActionEffect?.(this, activeTurn, progress);
    }

    drawBattleSkillCutIn(activeTurn = null, progress = 0) {
      return BattleEffectRenderer?.drawBattleSkillCutIn?.(this, activeTurn, progress);
    }

    drawBattleDamageFloat(activeTurn = null, phase = 'prepare', phaseProgress = 0, targetArea = null) {
      return BattleFloatingTextRenderer?.drawBattleDamageFloat?.(this, activeTurn, phase, phaseProgress, targetArea);
    }

    drawBattleStatusFloatingTexts(activeTurn = null, phase = 'prepare', phaseProgress = 0, areas = {}) {
      return BattleFloatingTextRenderer?.drawBattleStatusFloatingTexts?.(this, activeTurn, phase, phaseProgress, areas);
    }

    drawBattleLeader(sideView = {}, x = 0, y = 0, side = 'attacker') {
      const radius = 32;
      this.drawCircle(x, y, radius + 5, {
        fill: side === 'attacker' ? 'rgba(116, 211, 160, 0.12)' : 'rgba(224, 123, 98, 0.12)',
        stroke: side === 'attacker' ? 'rgba(116, 211, 160, 0.58)' : 'rgba(224, 123, 98, 0.58)',
        width: 2,
      });
      const portrait = side === 'attacker'
        ? this.drawFamousPortrait(sideView, x - radius, y - radius, radius * 2, {
          frameWidth: radius * 2,
          frameHeight: radius * 2,
          radius,
          scale: 1.58,
          offsetY: 0.12,
        })
        : false;
      if (!portrait) this.drawBattleLeaderFallback(sideView, x, y, side, radius);
      this.drawText(this.truncateText(sideView.leaderName || sideView.name || '', 96, { size: 12, bold: true }), x, y + radius + 10, {
        size: 12,
        bold: true,
        color: '#f6e8c8',
        align: 'center',
      });
    }

    drawBattleLeaderFallback(sideView = {}, x = 0, y = 0, side = 'attacker', radius = 32) {
      this.drawCircle(x, y, radius, {
        fill: side === 'attacker' ? '#2f6f59' : '#7f3d32',
        stroke: 'rgba(255, 226, 177, 0.5)',
        width: 2,
      });
      this.drawText(String(sideView.leaderName || sideView.name || '\u5c06').slice(0, 1), x, y, {
        size: 22,
        bold: true,
        color: '#f6e8c8',
        align: 'center',
        baseline: 'middle',
      });
    }

    renderBattleSceneOverlay(state = {}, options = {}) {
      if (!this.presenter || typeof this.presenter.buildBattleSceneViewState !== 'function') return;
      const now = this.getNow();
      const { frame, requestedTurnIndex, rawActiveTurn, playback } = this.getBattleScenePlayback(options.battleScene || {}, now);
      const view = this.presenter.buildBattleSceneViewState(options.battleScene || {}, {
        turnIndex: requestedTurnIndex,
        phase: playback.phase,
      });
      if (!view.visible) return;
      this.setHitTargets([]);
      this.drawBattleMapBackground(view.map);
      this.drawBattleSceneChrome(view, playback, requestedTurnIndex);
      this.drawBattleSceneArmies(view, {
        frame,
        activeTurn: view.activeTurn || rawActiveTurn,
        turnPhase: playback.phase,
        phaseProgress: playback.phaseProgress,
        requestedTurnIndex,
      });
      this.drawBattleSceneLog(view);
      this.drawBattleSceneButtons(view);
    }

    drawBattleSceneChrome(view = {}, playback = {}, requestedTurnIndex = 0) {
      const layout = this.getBattleSceneLayout(this.width, this.height);
      this.drawPanel(16, layout.topY, this.width - 32, 68, {
        fill: 'rgba(20, 16, 12, 0.72)',
        stroke: 'rgba(255, 226, 177, 0.22)',
        radius: 10,
      });
      this.drawText(this.truncateText(view.title, this.width - 80, { size: 18, bold: true }), this.width / 2, layout.topY + 12, {
        size: 18,
        bold: true,
        color: '#ffe6b5',
        align: 'center',
      });
      const total = Math.max(1, view.turnCount || 1);
      const current = view.ended ? total : Math.min((view.turnIndex ?? requestedTurnIndex) + 1, total);
      const turnText = '\u7b2c' + current + '/' + total + ' \u624b';
      this.drawText(`${turnText} - ${view.resultText || ''}`, this.width / 2, layout.topY + 40, {
        size: 12,
        color: '#d6b16e',
        align: 'center',
      });
    }

    drawBattleSceneArmies(view = {}, context = {}) {
      const activeTurn = context.activeTurn;
      const turnPhase = context.turnPhase || 'ended';
      const phaseProgress = context.phaseProgress || 1;
      const layout = this.getBattleSceneLayout(this.width, this.height);
      const engagementProgress = this.getBattleEngagementProgress(context.requestedTurnIndex, turnPhase, phaseProgress, activeTurn);
      const attackerPose = this.getBattleUnitPose('attacker', activeTurn, turnPhase);
      const defenderPose = this.getBattleUnitPose('defender', activeTurn, turnPhase);
      this.drawBattleLeader(view.attacker, 72, layout.fieldTop + 64, 'attacker');
      this.drawBattleLeader(view.defender, this.width - 72, layout.fieldTop + 64, 'defender');
      this.drawBattleSideState(view.attacker, layout.attackerArea, 'attacker');
      this.drawBattleSideState(view.defender, layout.defenderArea, 'defender');
      this.drawBattleArmy(view.attacker, layout.attackerArea, { pose: attackerPose, frame: context.frame, progress: phaseProgress, engagementProgress, actionType: activeTurn?.action });
      this.drawBattleArmy(view.defender, layout.defenderArea, { pose: defenderPose, frame: context.frame, progress: phaseProgress, engagementProgress, actionType: activeTurn?.action });
      this.drawBattleActionEffect(turnPhase === 'impact' ? activeTurn : null, phaseProgress);
      this.drawBattleSkillCutIn(turnPhase === 'cutin' ? activeTurn : null, phaseProgress);
      this.drawBattleDamageFloat(activeTurn, turnPhase, phaseProgress, activeTurn?.target === 'attacker' ? layout.attackerArea : layout.defenderArea);
      this.drawBattleStatusFloatingTexts(activeTurn, turnPhase, phaseProgress, {
        attacker: layout.attackerArea,
        defender: layout.defenderArea,
      });
    }

    drawBattleSceneLog(view = {}) {
      const layout = this.getBattleSceneLayout(this.width, this.height);
      this.drawPanel(16, layout.logY, this.width - 32, layout.logH, {
        fill: 'rgba(20, 16, 12, 0.76)',
        stroke: 'rgba(255, 226, 177, 0.18)',
        radius: 10,
      });
      const lines = view.logLines?.length ? view.logLines : ['\u53cc\u65b9\u5217\u9635\uff0c\u6218\u6597\u5373\u5c06\u5f00\u59cb\u3002'];
      lines.slice(-4).forEach((line, index, list) => {
        this.drawText(this.truncateText(line, this.width - 56, { size: 12 }), 28, layout.logY + 14 + index * 24, {
          size: 12,
          color: index === list.length - 1 ? '#f6e8c8' : '#aeb0b8',
        });
      });
    }

    drawBattleSceneButtons(view = {}) {
      const layout = this.getBattleSceneLayout(this.width, this.height);
      this.drawButton(18, layout.buttonY, 88, 36, '\u8fd4\u56de', { size: 12, radius: 8 });
      this.addHitTarget({ x: 18, y: layout.buttonY, width: 88, height: 36 }, { type: 'closeBattleScene' });
      const primaryLabel = view.ended ? '\u5b8c\u6210' : '\u8df3\u8fc7';
      this.drawButton(this.width - 106, layout.buttonY, 88, 36, primaryLabel, { size: 12, radius: 8, active: true });
      this.addHitTarget({ x: this.width - 106, y: layout.buttonY, width: 88, height: 36 }, { type: view.ended ? 'closeBattleScene' : 'skipBattleScene' });
    }

    // ============================================================
    // Entity battle (battleSimCore live sim) — pure canvas overlay.
    // ============================================================
    getEntityBattleCore() {
      const view = (typeof window !== 'undefined' ? window : globalThis);
      return view.BattleSimCore || null;
    }

    getEntityBattleLayout(entityBattle = {}) {
      const W = this.width;
      const H = this.height;
      const hudH = 30;
      const panelH = entityBattle.mode === 'interactive'
        ? Math.min(260, Math.max(184, Math.round(H * 0.42)))
        : 60;
      const stageTop = hudH;
      const stageBottom = H - panelH;
      return { W, H, hudH, panelH, stageTop, stageBottom, stageH: Math.max(40, stageBottom - stageTop) };
    }

    renderEntityBattleOverlay(_state = {}, options = {}) {
      const entityBattle = options.entityBattle;
      if (!entityBattle || !entityBattle.visible || !entityBattle.battle) return;
      const layout = this.getEntityBattleLayout(entityBattle);
      this.setHitTargets([]);
      this.drawEntityBattleBackground(entityBattle);
      this.drawEntityBattleField(entityBattle, layout);
      this.drawEntityBattleTopHud(entityBattle, layout);
      if (entityBattle.mode === 'interactive') this.drawEntityBattleControls(entityBattle, layout);
      else this.drawEntityReplayControls(entityBattle, layout);
      if (entityBattle.ended) this.drawEntityBattleResult(entityBattle, layout);
    }

    drawEntityBattleBackground(entityBattle = {}) {
      const path = entityBattle.bgPath || 'assets/art/battle/battlefield-forest-camp.png';
      if (this.drawCoverAsset(path, 0, 0, this.width, this.height)) return;
      if (!this.ctx) return;
      this.ctx.fillStyle = '#0c1116';
      this.ctx.fillRect(0, 0, this.width, this.height);
    }

    drawEntityBattleField(entityBattle = {}, layout = {}) {
      const ctx = this.ctx;
      if (!ctx) return;
      const battle = entityBattle.battle;
      const arena = entityBattle.arena || { w: layout.W, h: layout.stageH };
      // Camera: the pure policy owns fit + zoom/pan math; the renderer only reads
      // the resulting transform. _viewFit is stashed for the input layer so it can
      // map screen<->world for zoom-at-cursor / pan without recomputing layout.
      const stage = { x: 0, y: layout.stageTop, w: layout.W, h: layout.stageH };
      const fit = BattleCameraPolicy
        ? BattleCameraPolicy.computeFit(arena, stage)
        : { scale: Math.min(layout.W / (arena.w || layout.W), layout.stageH / (arena.h || layout.stageH)) || 1, contentW: 0, contentH: 0, stageX: 0, stageY: layout.stageTop, stageW: layout.W, stageH: layout.stageH };
      entityBattle._viewFit = fit;
      const camera = entityBattle.camera || { zoom: 1, offsetX: 0, offsetY: 0 };
      const transform = BattleCameraPolicy
        ? BattleCameraPolicy.getViewTransform(camera, fit)
        : { scale: fit.scale, offsetX: (layout.W - (arena.w || layout.W) * fit.scale) / 2, offsetY: layout.stageTop + (layout.stageH - (arena.h || layout.stageH) * fit.scale) / 2 };
      const scale = transform.scale;
      const offX = transform.offsetX;
      const offY = transform.offsetY;
      const now = this.getNow();
      const base = (now / ENTITY_FRAME_MS) | 0;
      const rstate = entityBattle._rstate || (entityBattle._rstate = {});
      const units = battle.units || [];
      // Clip to the stage so zoomed/panned sprites never spill into HUD/panel.
      const canClip = typeof ctx.save === 'function'
        && typeof ctx.restore === 'function'
        && typeof ctx.beginPath === 'function'
        && typeof ctx.rect === 'function'
        && typeof ctx.clip === 'function';
      if (canClip) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(stage.x, stage.y, stage.w, stage.h);
        ctx.clip();
      }
      const draw = [];
      for (let i = 0; i < units.length; i += 1) {
        const u = units[i];
        if (!u || !u.alive || u.left) continue;
        const rs = rstate[u.id] || (rstate[u.id] = { fx: u.side === 0 ? 1 : -1, px: u.x });
        if (u.x > rs.px + 0.05) rs.fx = 1;
        else if (u.x < rs.px - 0.05) rs.fx = -1;
        rs.px = u.x;
        draw.push(u);
      }
      draw.sort((a, b) => a.y - b.y);
      for (let j = 0; j < draw.length; j += 1) {
        const d = draw[j];
        const h = (d.kind === 'general' ? 46 : 16) * scale * ENTITY_SPRITE_SCALE;
        const w = Math.round((h * 500) / 400);
        const x = offX + d.x * scale;
        const y = offY + d.y * scale;
        const side = d.side === 0 ? 'player' : 'enemy';
        const pose = ENTITY_STATE_POSE[d.state] || 'move';
        const frameIdx = (base + (d.id % ENTITY_FRAMES)) % ENTITY_FRAMES;
        const path = `assets/art/battle/units/${side}/${pose}/${String(frameIdx + 1).padStart(2, '0')}.png`;
        const img = this.getAsset(path);
        let drew = false;
        if (img && (img.naturalWidth || img.width)) {
          if (rstate[d.id].fx < 0) {
            ctx.save();
            ctx.translate(x, 0);
            ctx.scale(-1, 1);
            ctx.drawImage(img, -w / 2, y - h, w, h);
            ctx.restore();
          } else {
            ctx.drawImage(img, x - w / 2, y - h, w, h);
          }
          drew = true;
        }
        if (!drew) {
          ctx.fillStyle = d.side === 0 ? '#f0564b' : '#4a9bf0';
          ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
        }
        if (d.kind === 'general') {
          ctx.fillStyle = d.side === 0 ? '#3fb950' : '#f0c000';
          ctx.fillRect(x - 2, y - h - 6, 4, 4);
        }
      }
      if (canClip) ctx.restore();
    }

    drawEntityBattleTopHud(entityBattle = {}, layout = {}) {
      const Core = this.getEntityBattleCore();
      const battle = entityBattle.battle;
      const counts = Core && typeof Core.countOnField === 'function' ? Core.countOnField(battle) : [0, 0];
      this.drawPanel(8, 4, layout.W - 16, layout.hudH - 6, {
        fill: 'rgba(0, 0, 0, 0.5)',
        stroke: 'rgba(255, 226, 177, 0.18)',
        radius: 6,
      });
      const midY = 4 + (layout.hudH - 6) / 2;
      this.drawText(`tick ${battle.tick || 0}`, 16, midY, { size: 11, color: '#58a6ff', baseline: 'middle' });
      this.drawText(`我方 ${counts[0] || 0}`, 92, midY, { size: 11, color: '#3fb950', baseline: 'middle' });
      this.drawText(`敌方 ${counts[1] || 0}`, 168, midY, { size: 11, color: '#f0c000', baseline: 'middle' });
      this.drawText(entityBattle.status || '交战中…', layout.W - 16, midY, {
        size: 11,
        color: entityBattle.statusColor || '#d29922',
        align: 'right',
        baseline: 'middle',
      });
    }

    drawEntityButtonRow(label, items = [], x = 0, y = 0, maxW = 0) {
      const labelW = 52;
      const btnH = 26;
      const gap = 5;
      this.drawText(label, x, y + btnH / 2, { size: 11, color: '#8b98a5', baseline: 'middle' });
      let cx = x + labelW;
      let cy = y;
      items.forEach((item) => {
        const tw = this.measureTextWidth(item.label, { size: 12 }) + 16;
        const bw = Math.max(40, Math.min(maxW - labelW, tw));
        if (cx + bw > x + maxW) {
          cx = x + labelW;
          cy += btnH + gap;
        }
        this.drawButton(cx, cy, bw, btnH, item.label, {
          size: 12,
          radius: 6,
          active: Boolean(item.active),
          disabled: Boolean(item.disabled),
        });
        if (!item.disabled && item.action) {
          this.addHitTarget({ x: cx, y: cy, width: bw, height: btnH }, item.action);
        }
        cx += bw + gap;
      });
      return cy + btnH + gap;
    }

    drawEntityBattleControls(entityBattle = {}, layout = {}) {
      const Core = this.getEntityBattleCore();
      const battle = entityBattle.battle;
      const top = layout.H - layout.panelH;
      this.drawPanel(0, top, layout.W, layout.panelH, {
        fill: 'rgba(22, 27, 34, 0.96)',
        stroke: 'rgba(255, 226, 177, 0.12)',
        radius: 0,
      });
      const pad = 10;
      const x = pad;
      const maxW = layout.W - pad * 2;
      let y = top + 8;
      const tickHz = entityBattle.tickHz || 20;
      const disabled = Boolean(battle.result) || Boolean(entityBattle.ended);
      const squads = battle.squads || {};

      const genItems = [];
      Object.keys(squads).forEach((gid) => {
        if (squads[gid].side !== 0) return;
        genItems.push({
          label: gid,
          active: gid === entityBattle.selectedGid,
          action: { type: 'entityBattleSelectGeneral', gid },
        });
      });
      y = this.drawEntityButtonRow('选将', genItems, x, y, maxW);

      const sq = squads[entityBattle.selectedGid];

      const orderItems = ENTITY_ORDER_LABELS.map((pair) => {
        const cd = sq ? (sq.orderCdLeft || 0) : 0;
        const labelCd = cd > 0 ? ` (${Math.ceil(cd / tickHz)}s)` : '';
        return {
          label: pair[1] + labelCd,
          disabled: disabled || cd > 0 || !sq,
          action: { type: 'entityBattleOrder', gid: entityBattle.selectedGid, order: pair[0] },
        };
      });
      y = this.drawEntityButtonRow('单部队令', orderItems, x, y, maxW);

      const masterItems = ENTITY_MASTER_LABELS.map((pair) => {
        const used = battle.masterUsed && battle.masterUsed[0] && battle.masterUsed[0][pair[0]];
        return {
          label: pair[1],
          active: true,
          disabled: disabled || Boolean(used),
          action: { type: 'entityBattleMaster', order: pair[0] },
        };
      });
      y = this.drawEntityButtonRow('全军总令', masterItems, x, y, maxW);

      const gen = sq ? battle.units[sq.generalId] : null;
      const rageMax = battle.config && battle.config.rageMax;
      const skillItems = [];
      ((gen && gen.skills) || []).forEach((sk, idx) => {
        const ready = Core && typeof Core.skillReady === 'function' ? Core.skillReady(battle, gen, sk, idx) : false;
        const info = sk.kind === 'ultimate'
          ? `怒${Math.floor(gen.rage || 0)}/${sk.rageCost || rageMax}`
          : ((gen.skillCds && gen.skillCds[idx] > 0) ? `${Math.ceil(gen.skillCds[idx] / tickHz)}s` : '就绪');
        skillItems.push({
          label: `${sk.name}[${info}]${sk.auto ? '·自' : ''}`,
          disabled: disabled || !ready,
          action: { type: 'entityBattleSkill', gid: entityBattle.selectedGid, skillId: sk.id },
        });
      });
      if (!skillItems.length) skillItems.push({ label: '无技能', disabled: true });
      this.drawEntityButtonRow('技能', skillItems, x, y, maxW);

      // Bottom row (anchored): 自动 托管 toggle + 完成 (only after the battle ends).
      const bh = 28;
      const by = layout.H - bh - 8;
      const autoLabel = `自动: ${entityBattle.auto ? '开' : '关'}`;
      const autoW = Math.max(72, this.measureTextWidth(autoLabel, { size: 12 }) + 18);
      this.drawButton(x, by, autoW, bh, autoLabel, { size: 12, radius: 6, active: Boolean(entityBattle.auto) });
      this.addHitTarget({ x, y: by, width: autoW, height: bh }, { type: 'entityBattleAuto' });
      if (entityBattle.ended) {
        const dw = 88;
        const dx = layout.W - dw - pad;
        this.drawButton(dx, by, dw, bh, '完成', { size: 13, radius: 6, active: true });
        this.addHitTarget({ x: dx, y: by, width: dw, height: bh }, { type: 'entityBattleDone' });
      }
    }

    drawEntityReplayControls(entityBattle = {}, layout = {}) {
      const top = layout.H - layout.panelH;
      this.drawPanel(0, top, layout.W, layout.panelH, {
        fill: 'rgba(0, 0, 0, 0.5)',
        stroke: 'rgba(255, 226, 177, 0.1)',
        radius: 0,
      });
      const bh = 32;
      const bw = 76;
      const by = top + (layout.panelH - bh) / 2;
      const summary = (entityBattle.report && entityBattle.report.summary) || '';
      this.drawText(this.truncateText(summary, layout.W - bw * 2 - 40, { size: 12 }), 14, top + layout.panelH / 2, {
        size: 12,
        color: '#cbd5e1',
        baseline: 'middle',
      });
      const doneX = layout.W - bw - 12;
      this.drawButton(doneX, by, bw, bh, '完成', { size: 13, radius: 8, active: true });
      this.addHitTarget({ x: doneX, y: by, width: bw, height: bh }, { type: 'entityBattleClose' });
      const backX = doneX - bw - 8;
      this.drawButton(backX, by, bw, bh, '返回', { size: 13, radius: 8 });
      this.addHitTarget({ x: backX, y: by, width: bw, height: bh }, { type: 'entityBattleClose' });
    }

    entityBattleSideSurvivors(entityBattle = {}, side = 0, result = {}) {
      const battle = entityBattle.battle;
      const survivors = (result && result.survivorsByGid) || {};
      const squads = battle.squads || {};
      const parts = [];
      let total = 0;
      Object.keys(squads).forEach((gid) => {
        if (squads[gid].side !== side) return;
        const n = Math.floor(survivors[gid] || 0);
        total += n;
        parts.push(`${gid} ${n}`);
      });
      return `${parts.join(' , ')}  (总 ${total})`;
    }

    drawEntityBattleResult(entityBattle = {}, layout = {}) {
      const winner = entityBattle.resultWinner;
      const win = winner === 'attacker';
      const draw = winner === 'draw';
      const title = win ? '胜利' : (draw ? '平局' : '失败');
      const color = win ? '#3fb950' : (draw ? '#d29922' : '#f85149');
      const boxW = Math.min(layout.W - 40, 320);
      const boxH = 124;
      const bx = (layout.W - boxW) / 2;
      const by = layout.stageTop + (layout.stageH - boxH) / 2;
      this.drawPanel(bx, by, boxW, boxH, {
        fill: 'rgba(13, 17, 23, 0.95)',
        stroke: 'rgba(42, 51, 64, 1)',
        radius: 10,
      });
      this.drawText(title, bx + boxW / 2, by + 22, { size: 20, bold: true, color, align: 'center', baseline: 'middle' });
      const result = entityBattle.serverResult || (entityBattle.battle && entityBattle.battle.result) || {};
      this.drawText(`我方剩余: ${this.entityBattleSideSurvivors(entityBattle, 0, result)}`, bx + 14, by + 52, { size: 12, color: '#cbd5e1' });
      this.drawText(`敌方剩余: ${this.entityBattleSideSurvivors(entityBattle, 1, result)}`, bx + 14, by + 74, { size: 12, color: '#cbd5e1' });
      this.drawText(`用时 ${result.ticks || 0} tick · 指令 ${entityBattle.inputStreamLen || 0} 条 (后端权威重算)`, bx + 14, by + 98, { size: 10, color: '#8b98a5' });
    }
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = BattleCanvasRenderer;
  else global.BattleCanvasRenderer = BattleCanvasRenderer;
})(typeof window !== 'undefined' ? window : globalThis);
