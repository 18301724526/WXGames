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

  function model(method, args = [], fallback = undefined) {
    const fn = BattleCanvasModel?.[method];
    if (typeof fn === 'function') return fn(...args);
    return typeof fallback === 'function' ? fallback() : fallback;
  }

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
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = BattleCanvasRenderer;
  else global.BattleCanvasRenderer = BattleCanvasRenderer;
})(typeof window !== 'undefined' ? window : globalThis);
